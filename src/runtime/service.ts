import { errors, RuntimeError } from "./errors"
import type {
  AssembleContextRequest,
  AssembleContextResponse,
  Atom,
  ConsolidateRequest,
  ConsolidateResponse,
  ContextWarning,
  DurableMemoryObject,
  Episode,
  GetJobRequest,
  GetJobResponse,
  HydrateRequest,
  HydrateResponse,
  IngestRequest,
  IngestResponse,
  Link,
  MemoryEvent,
  MemoryRef,
  QueryRequest,
  QueryResponse,
  Scope,
  SubscribeRequest,
  TombstoneRequest,
  TombstoneResponse,
} from "./types"
import type {
  EpisodeStore,
  GraphStore,
  IndexStore,
  JobRecord,
  MetadataStore,
  ObjectStore,
} from "./ports"
import type { RuntimeMetricsHook } from "./observability"
import type {
  ConsolidatorPlugin,
  EmbedderPlugin,
  ExtractorPlugin,
  RankerPlugin,
} from "./plugins"
import { NoopExtractorPlugin, SimpleConsolidatorPlugin, SimpleEmbedderPlugin, SimpleRankerPlugin } from "./plugins"
import { isVisibleForRead } from "./adapters/inMemoryStores"
import { estimateTokens, nowIso, randomId, refKey } from "./utils"
import { assertScope } from "./validation"

export type MemoryRuntimeDependencies = {
  episodeStore: EpisodeStore
  graphStore: GraphStore
  indexStore: IndexStore
  metadataStore: MetadataStore
  objectStore: ObjectStore
  extractor?: ExtractorPlugin
  embedder?: EmbedderPlugin
  ranker?: RankerPlugin
  consolidator?: ConsolidatorPlugin
  metricsHook?: RuntimeMetricsHook
}

const asyncTombstoneRefThreshold = 5

const asRef = (object: DurableMemoryObject): MemoryRef => ({
  id: object.id,
  type: object.type,
  scope: object.scope,
})

const defaultCreatedBy = {
  id: "runtime",
  kind: "system",
} as const

export class MemoryRuntimeService {
  private readonly deps: MemoryRuntimeDependencies
  private readonly metricsHook?: RuntimeMetricsHook

  constructor(deps: MemoryRuntimeDependencies) {
    this.metricsHook = deps.metricsHook
    this.deps = {
      ...deps,
      extractor: deps.extractor ?? new NoopExtractorPlugin(),
      embedder: deps.embedder ?? new SimpleEmbedderPlugin(),
      ranker: deps.ranker ?? new SimpleRankerPlugin(),
      consolidator: deps.consolidator ?? new SimpleConsolidatorPlugin(),
    }
  }

  async ingest(request: IngestRequest): Promise<IngestResponse> {
    assertScope(request.scope)
    await this.deps.metadataStore.storeScope(request.scope)

    const results: IngestResponse["results"] = []

    for (const ingestEpisode of request.episodes) {
      try {
        const dedupeHit = ingestEpisode.dedupeKey
          ? await this.deps.episodeStore.resolveDedupeKey(request.scope, ingestEpisode.dedupeKey)
          : null

        const contentFingerprint = JSON.stringify(ingestEpisode.content)
        if (dedupeHit && ingestEpisode.dedupeKey) {
          const existingFingerprint = JSON.stringify(dedupeHit.content)
          if (existingFingerprint !== contentFingerprint) throw errors.dedupeConflict(ingestEpisode.dedupeKey)

          results.push({
            ref: { id: dedupeHit.id, type: "episode", scope: dedupeHit.scope },
            status: "deduplicated",
          })
          continue
        }

        const episode: Episode = {
          id: randomId("ep"),
          type: "episode",
          scope: request.scope,
          createdAt: nowIso(),
          createdBy: ingestEpisode.createdBy,
          status: "active",
          dedupeKey: ingestEpisode.dedupeKey,
          contentType: ingestEpisode.contentType,
          content: ingestEpisode.content,
          metadata: ingestEpisode.metadata ?? {},
        }

        await this.deps.episodeStore.appendEpisode(episode)
        await this.deps.objectStore.upsert(episode)

        const embedded = await this.deps.embedder!.embed({
          ref: asRef(episode),
          text: typeof episode.content === "string" ? episode.content : JSON.stringify(episode.content),
          metadata: episode.metadata,
        })

        await this.deps.indexStore.indexMemory({
          ref: asRef(episode),
          text: embedded.payloadText,
          metadata: { algorithm: embedded.algorithm, ...episode.metadata },
        })

        const extracted = await this.deps.extractor!.extract({
          sourceRefs: [asRef(episode)],
          sourceContent: [episode],
          scope: request.scope,
        })

        for (const atomDraft of extracted.atoms) {
          const atomCreatedAt = nowIso()
          const atom: Atom = {
            id: randomId("atom"),
            type: "atom",
            scope: request.scope,
            createdAt: atomCreatedAt,
            createdBy: ingestEpisode.createdBy,
            status: "active",
            atomType: atomDraft.atomType,
            content: atomDraft.content,
            confidence: atomDraft.confidence,
            provenance: {
              sourceRefs: [asRef(episode)],
              producedBy: { id: this.deps.extractor!.descriptor.name, kind: "plugin" },
              createdAt: atomCreatedAt,
              transformation: "extraction",
              confidence: atomDraft.confidence,
            },
            metadata: atomDraft.metadata ?? {},
          }

          await this.deps.objectStore.upsert(atom)
          await this.deps.indexStore.indexMemory({
            ref: asRef(atom),
            text: atom.content,
            metadata: { atomType: atom.atomType, ...atom.metadata },
          })
          await createDerivedLink(this.deps.graphStore, request.scope, asRef(atom), asRef(episode))
        }

        for (const linkDraft of extracted.links) {
          const link: Link = {
            id: randomId("lnk"),
            type: "link",
            scope: request.scope,
            createdAt: nowIso(),
            createdBy: ingestEpisode.createdBy,
            status: "active",
            linkType: linkDraft.linkType,
            from: linkDraft.from,
            to: linkDraft.to,
            metadata: linkDraft.metadata ?? {},
          }
          await this.deps.graphStore.addLink(link)
          await this.deps.objectStore.upsert(link)
          await this.applyLinkSideEffects(link)
        }

        await this.appendEvent({
          id: randomId("evt"),
          type: "episode.ingested",
          scope: request.scope,
          timestamp: nowIso(),
          payload: { ref: asRef(episode) },
        })

        results.push({ ref: asRef(episode), status: "created" })
      } catch (error) {
        const runtimeError = this.normalizeError(error)
        results.push({
          ref: { id: randomId("rejected"), type: "episode", scope: request.scope },
          status: "rejected",
          error: runtimeError.toMemoryApiError(),
        })
      }
    }

    this.metricsHook?.onIngest?.(request.episodes.length)
    return { results }
  }

  async query(request: QueryRequest): Promise<QueryResponse> {
    assertScope(request.scope)

    if (request.consistency === "strong") {
      const freshness = await this.deps.indexStore.reportFreshness(request.scope)
      if (freshness === "stale" || freshness === "unknown") throw errors.unsupportedStrongConsistency()
    }

    const candidates = await this.deps.indexStore.search(
      request.scope,
      request.query,
      request.filters,
      request.limit,
    )

    const hydrated = await this.deps.objectStore.getMany(candidates.map((candidate) => candidate.ref))
    const hydratedByRef = new Map(hydrated.map((object) => [refKey(asRef(object)), object]))

    const refs = candidates
      .map((candidate) => ({ candidate, object: hydratedByRef.get(refKey(candidate.ref)) }))
      .filter((entry): entry is { candidate: (typeof candidates)[number]; object: DurableMemoryObject } =>
        Boolean(entry.object),
      )
      .filter((entry) => isVisibleForRead(entry.object, request.filters))
      .map((entry) => ({
        ref: entry.candidate.ref,
        score: entry.candidate.score,
        reason: entry.candidate.reason,
        excerpt: typeof entry.object.content === "string" ? entry.object.content : JSON.stringify(entry.object.content),
      }))

    const ranked = await this.deps.ranker!.rank({
      query: request.query,
      candidates: refs.map(({ ref, excerpt }) => ({ ref, excerpt })),
      scope: request.scope,
    })

    const rankedByRef = new Map(ranked.map((row) => [refKey(row.ref), row]))
    this.metricsHook?.onQuery?.()

    return {
      refs: refs
        .map((row) => {
          const rescored = rankedByRef.get(refKey(row.ref))
          return {
            ref: row.ref,
            score: rescored?.score ?? row.score,
            reason: rescored?.reason ?? row.reason,
          }
        })
        .sort((a, b) => b.score - a.score),
    }
  }

  async hydrate(request: HydrateRequest): Promise<HydrateResponse> {
    assertScope(request.scope)

    const objects = await this.deps.objectStore.getMany(request.refs)
    const visibleObjects = objects.filter((object) => object.status !== "tombstoned")
    const found = new Set(visibleObjects.map((object) => refKey(asRef(object))))
    const missing = request.refs.filter((ref) => !found.has(refKey(ref)))

    return { objects: visibleObjects, missing }
  }

  async assembleContext(request: AssembleContextRequest): Promise<AssembleContextResponse> {
    assertScope(request.scope)

    const warnings: ContextWarning[] = []
    if (request.consistency === "eventual") {
      warnings.push({
        code: "eventual_consistency",
        message: "context assembled under eventual consistency",
      })
    }

    const queryResult = await this.query({
      scope: request.scope,
      query: request.task,
      filters: request.filters,
      limit: request.constraints?.maxSegments ?? request.budget.maxSegments ?? 25,
      consistency: request.consistency,
    })

    const hydrated = await this.hydrate({ scope: request.scope, refs: queryResult.refs.map((ref) => ref.ref) })
    const objectByRef = new Map(hydrated.objects.map((object) => [refKey(asRef(object)), object]))

    const tokenLimit = Math.max(0, request.budget.maxTokens - (request.budget.reservedTokens ?? 0))
    let tokenEstimate = 0
    let truncated = false

    const segments: AssembleContextResponse["context"]["segments"] = []
    for (const resultRef of queryResult.refs) {
      const object = objectByRef.get(refKey(resultRef.ref))
      if (!object) continue

      if (object.status === "disputed") {
        warnings.push({ code: "disputed_memory_included", message: `disputed memory included: ${object.id}` })
      }
      if (object.status === "superseded") {
        warnings.push({
          code: "superseded_memory_included",
          message: `superseded memory included: ${object.id}`,
        })
      }

      if ("provenance" in object && object.provenance?.sourceRefs?.length) {
        for (const sourceRef of object.provenance.sourceRefs) {
          const source = objectByRef.get(refKey(sourceRef)) ?? (await this.deps.objectStore.get(sourceRef))
          if (source?.status === "tombstoned" || source?.status === "pending") {
            warnings.push({
              code: "stale_consolidation",
              message: `segment depends on ${source.status} source ${source.id}`,
              refs: [sourceRef],
            })
          }
        }
      }

      const content = "content" in object ? object.content : object.metadata
      const contentTokens = estimateTokens(content)
      if (segments.length > 0 && tokenEstimate + contentTokens > tokenLimit) {
        truncated = true
        break
      }

      tokenEstimate += contentTokens
      segments.push({
        ref: asRef(object),
        content,
        score: resultRef.score,
        reason: resultRef.reason ?? "retrieval match",
        provenance: "provenance" in object ? object.provenance : undefined,
      })

      if (request.budget.maxSegments && segments.length >= request.budget.maxSegments) {
        truncated = queryResult.refs.length > segments.length
        break
      }
    }

    if (segments.length === 0) {
      warnings.push({ code: "empty_context", message: "no memory matched the request" })
    }
    if (truncated) {
      warnings.push({ code: "truncated", message: "context truncated by budget" })
    }

    if (request.constraints?.mustIncludeRefs?.length) {
      const segmentKeys = new Set(segments.map((segment) => refKey(segment.ref)))
      const omitted = request.constraints.mustIncludeRefs.filter((ref) => !segmentKeys.has(refKey(ref)))
      if (omitted.length > 0) {
        warnings.push({
          code: "required_ref_omitted",
          message: "required refs omitted due to budget or filters",
          metadata: { refs: omitted },
        })
      }
    }

    return {
      context: {
        scope: request.scope,
        task: request.task,
        budget: request.budget,
        segments,
        tokenEstimate,
        truncated,
        warnings,
        generatedAt: nowIso(),
      },
    }
  }

  async consolidate(request: ConsolidateRequest): Promise<ConsolidateResponse> {
    assertScope(request.scope)

    const jobId = randomId("job")
    const createdAt = nowIso()
    const mode = request.mode ?? "enqueue"

    await this.deps.metadataStore.upsertJob({
      jobId,
      type: "consolidate",
      scope: request.scope,
      status: mode === "run_now" ? "running" : "queued",
      createdAt,
      updatedAt: createdAt,
      payload: request,
    })

    if (mode !== "run_now") {
      return { jobId, status: "queued" }
    }

    return this.executeConsolidateJob(jobId, request, createdAt)
  }

  async processJob(job: JobRecord): Promise<void> {
    if (job.status !== "queued") return

    const runningAt = nowIso()
    await this.deps.metadataStore.upsertJob({ ...job, status: "running", updatedAt: runningAt })

    try {
      if (job.type === "consolidate") {
        const request = job.payload as ConsolidateRequest
        const result = await this.executeConsolidateJob(job.jobId, request, job.createdAt)
        if (result.status === "completed") this.metricsHook?.onJobCompleted?.()
        if (result.status === "failed") this.metricsHook?.onJobFailed?.()
        return
      }

      if (job.type === "tombstone_cascade") {
        const request = job.payload as TombstoneRequest
        await this.executeTombstoneCascade(job.jobId, request, job.createdAt)
        this.metricsHook?.onJobCompleted?.()
        return
      }

      await this.deps.metadataStore.upsertJob({
        ...job,
        status: "failed",
        updatedAt: nowIso(),
        error: { code: "unsupported_job", message: `unknown job type ${job.type}`, retryable: false },
      })
      this.metricsHook?.onJobFailed?.()
    } catch (error) {
      const runtimeError = this.normalizeError(error)
      await this.deps.metadataStore.upsertJob({
        ...job,
        status: "failed",
        updatedAt: nowIso(),
        error: runtimeError.toMemoryApiError(),
      })
      this.metricsHook?.onJobFailed?.()
    }
  }

  async tombstone(request: TombstoneRequest): Promise<TombstoneResponse> {
    assertScope(request.scope)

    if (request.cascadePolicy !== "none" && request.refs.length >= asyncTombstoneRefThreshold) {
      const jobId = randomId("job")
      const createdAt = nowIso()
      await this.deps.metadataStore.upsertJob({
        jobId,
        type: "tombstone_cascade",
        scope: request.scope,
        status: "queued",
        createdAt,
        updatedAt: createdAt,
        payload: request,
      })
      return { jobId, results: [] }
    }

    const results = await this.executeTombstoneRefs(request)
    this.metricsHook?.onTombstone?.(request.refs.length)
    return { results }
  }

  async subscribe(request: SubscribeRequest): Promise<MemoryEvent[]> {
    assertScope(request.scope)
    const events = await this.deps.metadataStore.listEvents(request.scope, request.cursor)

    if (!request.eventTypes?.length) return events
    return events.filter((event) => request.eventTypes!.includes(event.type))
  }

  async getJob(request: GetJobRequest): Promise<GetJobResponse> {
    assertScope(request.scope)
    const job = await this.deps.metadataStore.getJob(request.scope, request.jobId)
    if (!job) throw errors.notFound(request.jobId)
    return {
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result,
      error: job.error,
    }
  }

  private normalizeError(error: unknown): RuntimeError {
    if (error instanceof RuntimeError) return error
    if (error instanceof Error) {
      return new RuntimeError({
        code: "runtime_error",
        message: error.message,
        retryable: false,
      })
    }
    return new RuntimeError({
      code: "runtime_error",
      message: "unknown runtime error",
      retryable: false,
    })
  }

  private async executeConsolidateJob(
    jobId: string,
    request: ConsolidateRequest,
    createdAt: string,
  ): Promise<ConsolidateResponse> {
    if (!this.deps.consolidator) {
      await this.deps.metadataStore.upsertJob({
        jobId,
        type: "consolidate",
        scope: request.scope,
        status: "failed",
        createdAt,
        updatedAt: nowIso(),
        error: { code: "consolidator_missing", message: "no consolidator registered", retryable: false },
      })
      return { jobId, status: "failed" }
    }

    try {
      await this.appendEvent({
        id: randomId("evt"),
        type: "consolidation.started",
        scope: request.scope,
        timestamp: nowIso(),
        payload: { jobId },
      })

      const sources = (await this.deps.objectStore.list(request.scope)).filter(
        (object) => object.status !== "tombstoned" && object.type !== "link",
      )
      const output = await this.deps.consolidator.consolidate({
        scope: request.scope,
        sourceRefs: sources.map(asRef),
        sourceContent: sources,
      })

      for (const item of output.consolidations) {
        const now = nowIso()
        const consolidation: DurableMemoryObject = {
          id: randomId("con"),
          type: "consolidation",
          scope: request.scope,
          createdAt: now,
          createdBy: defaultCreatedBy,
          status: "active",
          title: item.title,
          content: item.content,
          sourceRefs: sources.map(asRef),
          supersedes: item.supersedes,
          provenance: {
            sourceRefs: sources.map(asRef),
            producedBy: { id: this.deps.consolidator.descriptor.name, kind: "plugin" },
            createdAt: now,
            transformation: "consolidation",
            confidence: item.confidence,
          },
          metadata: item.metadata ?? {},
        }

        await this.deps.objectStore.upsert(consolidation)
        await this.deps.indexStore.indexMemory({
          ref: asRef(consolidation),
          text: consolidation.content,
          metadata: consolidation.metadata,
        })

        if (item.supersedes?.length) {
          await this.applySupersession(request.scope, item.supersedes, asRef(consolidation))
        }
      }

      for (const link of output.links) {
        await this.deps.graphStore.addLink(link)
        await this.deps.objectStore.upsert(link)
        await this.applyLinkSideEffects(link)
      }

      await this.deps.metadataStore.upsertJob({
        jobId,
        type: "consolidate",
        scope: request.scope,
        status: "completed",
        createdAt,
        updatedAt: nowIso(),
        result: { warnings: output.warnings },
      })

      await this.appendEvent({
        id: randomId("evt"),
        type: "consolidation.completed",
        scope: request.scope,
        timestamp: nowIso(),
        payload: { jobId },
      })

      return { jobId, status: "completed" }
    } catch (error) {
      const runtimeError = this.normalizeError(error)
      await this.deps.metadataStore.upsertJob({
        jobId,
        type: "consolidate",
        scope: request.scope,
        status: "failed",
        createdAt,
        updatedAt: nowIso(),
        error: runtimeError.toMemoryApiError(),
      })

      await this.appendEvent({
        id: randomId("evt"),
        type: "consolidation.failed",
        scope: request.scope,
        timestamp: nowIso(),
        payload: { jobId, error: runtimeError.toMemoryApiError() },
      })

      return { jobId, status: "failed" }
    }
  }

  private async executeTombstoneCascade(jobId: string, request: TombstoneRequest, createdAt: string): Promise<void> {
    const results = await this.executeTombstoneRefs(request)
    await this.deps.metadataStore.upsertJob({
      jobId,
      type: "tombstone_cascade",
      scope: request.scope,
      status: "completed",
      createdAt,
      updatedAt: nowIso(),
      result: { results },
    })
    this.metricsHook?.onTombstone?.(request.refs.length)
  }

  private async executeTombstoneRefs(request: TombstoneRequest): Promise<TombstoneResponse["results"]> {
    const results: TombstoneResponse["results"] = []
    const allObjects = await this.deps.objectStore.list(request.scope)
    const derivedFrom = new Map<string, MemoryRef[]>()

    for (const object of allObjects) {
      if ("provenance" in object && object.provenance) {
        for (const source of object.provenance.sourceRefs) {
          const key = refKey(source)
          const current = derivedFrom.get(key) ?? []
          current.push(asRef(object))
          derivedFrom.set(key, current)
        }
      }
    }

    for (const ref of request.refs) {
      const object = await this.deps.objectStore.get(ref)
      if (!object) {
        results.push({ ref, status: "not_found" })
        continue
      }

      if (object.status === "tombstoned") {
        results.push({ ref, status: "already_tombstoned" })
        continue
      }

      const tombstoned = { ...object, status: "tombstoned" as const }
      await this.deps.objectStore.upsert(tombstoned)
      await this.deps.indexStore.removeIndexed(ref)

      if (ref.type === "episode") {
        await this.deps.episodeStore.tombstoneEpisode(ref)
      }
      if (ref.type === "link") {
        await this.deps.graphStore.tombstoneLink(ref)
      }

      let affectedDerivedRefs: MemoryRef[] | undefined
      if (request.cascadePolicy !== "none") {
        const derived = derivedFrom.get(refKey(ref)) ?? []
        if (derived.length > 0) {
          affectedDerivedRefs = derived
          for (const derivedRef of derived) {
            const derivedObject = await this.deps.objectStore.get(derivedRef)
            if (!derivedObject) continue

            if (request.cascadePolicy === "mark_derived_stale") {
              if (derivedObject.status === "active") {
                await this.deps.objectStore.upsert({ ...derivedObject, status: "pending" })
              }
            }
            if (request.cascadePolicy === "tombstone_derived") {
              await this.deps.objectStore.upsert({ ...derivedObject, status: "tombstoned" })
              await this.deps.indexStore.removeIndexed(derivedRef)
            }
          }
        }
      }

      await this.appendEvent({
        id: randomId("evt"),
        type: "memory.tombstoned",
        scope: request.scope,
        timestamp: nowIso(),
        payload: { ref, cascadePolicy: request.cascadePolicy },
      })

      results.push({
        ref,
        status: "tombstoned",
        affectedDerivedRefs,
      })
    }

    return results
  }

  private async applySupersession(scope: Scope, supersededRefs: MemoryRef[], consolidationRef: MemoryRef): Promise<void> {
    for (const ref of supersededRefs) {
      const object = await this.deps.objectStore.get(ref)
      if (!object || object.status === "tombstoned") continue

      await this.deps.objectStore.upsert({ ...object, status: "superseded" })
      await this.deps.indexStore.removeIndexed(ref)

      const link: Link = {
        id: randomId("lnk"),
        type: "link",
        scope,
        status: "active",
        createdAt: nowIso(),
        createdBy: defaultCreatedBy,
        linkType: "supersedes",
        from: consolidationRef,
        to: ref,
        metadata: {},
      }
      await this.deps.graphStore.addLink(link)
      await this.deps.objectStore.upsert(link)

      await this.appendEvent({
        id: randomId("evt"),
        type: "memory.superseded",
        scope,
        timestamp: nowIso(),
        payload: { ref, supersededBy: consolidationRef },
      })
    }
  }

  private async applyLinkSideEffects(link: Link): Promise<void> {
    if (link.linkType !== "contradicts") return

    for (const ref of [link.from, link.to]) {
      const object = await this.deps.objectStore.get(ref)
      if (!object || object.type === "link") continue
      if (object.status !== "active") continue

      await this.deps.objectStore.upsert({ ...object, status: "disputed" })
      await this.appendEvent({
        id: randomId("evt"),
        type: "memory.disputed",
        scope: link.scope,
        timestamp: nowIso(),
        payload: { ref, linkId: link.id },
      })
    }
  }

  private async appendEvent(event: MemoryEvent): Promise<void> {
    await this.deps.metadataStore.appendEvent(event)
  }
}

export async function createDerivedLink(
  graphStore: GraphStore,
  scope: MemoryRef["scope"],
  from: MemoryRef,
  to: MemoryRef,
): Promise<Link> {
  const link: Link = {
    id: `${from.id}_derived_from_${to.id}`,
    type: "link",
    scope,
    status: "active",
    createdAt: nowIso(),
    linkType: "derived_from",
    from,
    to,
    metadata: {},
    createdBy: { id: "runtime", kind: "system" },
  }

  await graphStore.addLink(link)
  return link
}
