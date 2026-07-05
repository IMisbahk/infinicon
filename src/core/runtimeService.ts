import { ensureScope } from "./scope"
import {
  validateAssembleContext,
  validateConsolidate,
  validateGetJob,
  validateHydrate,
  validateIngest,
  validateQuery,
  validateSubscribe,
  validateTombstone,
} from "./validation"
import type {
  AssembleContextRequest,
  AssembleContextResponse,
  ConsolidateRequest,
  ConsolidateResponse,
  ContextSegment,
  ContextWarning,
  Episode,
  EpisodeStore,
  GetJobRequest,
  GetJobResponse,
  GraphStore,
  HydrateRequest,
  HydrateResponse,
  IdFactory,
  IndexStore,
  IngestRequest,
  IngestResponse,
  JobRecord,
  MemoryEvent,
  MemoryRef,
  MetadataStore,
  QueryRequest,
  QueryResponse,
  SubscribeRequest,
  SubscribeResponse,
  TombstoneRequest,
  TombstoneResponse,
} from "./types"

function toRef(episode: Episode): MemoryRef {
  return {
    id: episode.id,
    type: "episode",
    scope: episode.scope,
  }
}

function estimateTokens(content: unknown): number {
  const text = typeof content === "string" ? content : JSON.stringify(content)
  return Math.ceil(text.length / 4)
}

export class RuntimeService {
  constructor(
    private readonly episodeStore: EpisodeStore,
    private readonly graphStore: GraphStore,
    private readonly indexStore: IndexStore,
    private readonly metadataStore: MetadataStore,
    private readonly ids: IdFactory,
  ) {}

  private async emitEvent(type: MemoryEvent["type"], scope: MemoryEvent["scope"], payload: Record<string, unknown>): Promise<void> {
    const event: MemoryEvent = {
      id: this.ids.next(),
      scope,
      type,
      at: new Date().toISOString(),
      payload,
      cursor: `${Date.now()}-${this.ids.next()}`,
    }
    await this.metadataStore.appendEvent(event)
  }

  async ingest(req: IngestRequest): Promise<IngestResponse> {
    validateIngest(req)
    const now = new Date().toISOString()
    const results: IngestResponse["results"] = []

    for (const input of req.episodes) {
      if (input.dedupeKey) {
        const existing = await this.episodeStore.resolveDedupeKey(req.scope, input.dedupeKey)
        if (existing) {
          results.push({ ref: toRef(existing), status: "deduplicated" })
          continue
        }
      }

      const episode: Episode = {
        id: this.ids.next(),
        type: "episode",
        scope: req.scope,
        createdAt: now,
        createdBy: input.createdBy,
        status: "active",
        dedupeKey: input.dedupeKey,
        contentType: input.contentType,
        content: input.content,
        metadata: input.metadata ?? {},
      }

      await this.episodeStore.appendEpisode(episode)
      await this.indexStore.indexEpisode(episode)
      await this.emitEvent("episode.ingested", req.scope, { ref: toRef(episode), consistency: req.consistency ?? "accepted" })
      await this.emitEvent("memory.indexed", req.scope, { ref: toRef(episode) })
      results.push({ ref: toRef(episode), status: "created" })
    }

    return { results }
  }

  async query(req: QueryRequest): Promise<QueryResponse> {
    validateQuery(req)
    const rows = await this.indexStore.search(req)
    return {
      refs: rows.map((row) => ({
        ref: row.ref,
        score: row.score,
        reason: row.reason,
      })),
    }
  }

  async hydrate(req: HydrateRequest): Promise<HydrateResponse> {
    validateHydrate(req)
    const objects: Episode[] = []
    const missing: MemoryRef[] = []
    const rows = await this.episodeStore.getEpisodesByRefs(req.refs)

    for (let i = 0; i < req.refs.length; i += 1) {
      const row = rows[i]
      if (row) {
        objects.push(row)
      } else {
        missing.push(req.refs[i])
      }
    }

    return { objects, missing }
  }

  async assembleContext(req: AssembleContextRequest): Promise<AssembleContextResponse> {
    validateAssembleContext(req)
    const warnings: ContextWarning[] = []
    if (req.consistency === "eventual") {
      warnings.push({ code: "eventual_consistency", message: "assembled context using eventual consistency" })
    }

    const excluded = new Set((req.constraints?.excludedRefs ?? []).map((ref) => `${ref.type}:${ref.id}`))
    const query = await this.query({
      scope: req.scope,
      query: req.task,
      filters: req.filters,
      consistency: req.consistency,
      limit: (req.budget.maxSegments ?? 20) + excluded.size,
    })

    const filteredRefs = query.refs.map((r) => r.ref).filter((ref) => !excluded.has(`${ref.type}:${ref.id}`))

    const hydrate = await this.hydrate({
      scope: req.scope,
      refs: filteredRefs,
      includeProvenance: false,
    })

    if (hydrate.missing.length > 0) {
      warnings.push({ code: "partial_hydration", message: "some refs were not available during hydration" })
    }

    const maxTokens = Math.max(0, req.budget.maxTokens - (req.budget.reserveTokens ?? 0))
    const maxSegments = req.budget.maxSegments ?? Number.POSITIVE_INFINITY
    const segments: ContextSegment[] = []
    let tokenEstimate = 0
    let truncated = false

    for (const object of hydrate.objects) {
      if (segments.length >= maxSegments) {
        truncated = true
        break
      }
      const segmentCost = estimateTokens(object.content)
      if (tokenEstimate + segmentCost > maxTokens) {
        truncated = true
        break
      }
      tokenEstimate += segmentCost
      segments.push({
        ref: toRef(object),
        content: object.content,
        score: 1,
        reason: "high relevance to task",
      })
    }

    const mustInclude = req.constraints?.mustIncludeRefs ?? []
    for (const mustRef of mustInclude) {
      const alreadyIncluded = segments.some((segment) => segment.ref.id === mustRef.id && segment.ref.type === mustRef.type)
      if (!alreadyIncluded) {
        warnings.push({ code: "required_ref_omitted", message: `required ref omitted: ${mustRef.type}:${mustRef.id}` })
      }
    }

    if (segments.length === 0) {
      warnings.push({ code: "empty_context", message: "no memory matched task and filters" })
    }
    if (truncated) {
      warnings.push({ code: "truncated", message: "context was truncated to respect budget" })
    }

    return {
      context: {
        scope: req.scope,
        task: req.task,
        budget: req.budget,
        segments,
        tokenEstimate,
        truncated,
        warnings,
        generatedAt: new Date().toISOString(),
      },
    }
  }

  async consolidate(req: ConsolidateRequest): Promise<ConsolidateResponse> {
    validateConsolidate(req)
    const now = new Date().toISOString()
    const jobId = this.ids.next()
    const mode = req.mode ?? "enqueue"

    const baseJob: JobRecord = {
      jobId,
      scope: req.scope,
      type: "consolidation",
      status: mode === "run_now" ? "running" : "queued",
      createdAt: now,
      updatedAt: now,
      result: {
        trigger: req.trigger,
      },
    }

    await this.metadataStore.createJob(baseJob)
    await this.emitEvent("consolidation.started", req.scope, { jobId, trigger: req.trigger })

    if (mode === "run_now") {
      const completed: JobRecord = {
        ...baseJob,
        status: "completed",
        updatedAt: new Date().toISOString(),
      }
      await this.metadataStore.updateJob(completed)
      await this.emitEvent("consolidation.completed", req.scope, { jobId })
      return { jobId, status: "completed" }
    }

    return { jobId, status: "queued" }
  }

  async getJob(req: GetJobRequest): Promise<GetJobResponse> {
    validateGetJob(req)
    const job = await this.metadataStore.getJob(req.scope, req.jobId)
    if (!job) {
      throw new Error(`job not found: ${req.jobId}`)
    }
    return job
  }

  async subscribe(req: SubscribeRequest): Promise<SubscribeResponse> {
    validateSubscribe(req)
    const events = await this.metadataStore.listEvents(req)
    return {
      events,
      cursor: events.length > 0 ? events[events.length - 1].cursor : req.cursor,
    }
  }

  async tombstone(req: TombstoneRequest): Promise<TombstoneResponse> {
    validateTombstone(req)
    const results: TombstoneResponse["results"] = []

    for (const ref of req.refs) {
      if (ref.type !== "episode") {
        results.push({
          ref,
          status: "rejected",
          error: {
            code: "unsupported_type",
            message: `tombstone currently supports episode refs only got ${ref.type}`,
            retryable: false,
          },
        })
        continue
      }

      const existing = await this.episodeStore.getEpisodeByRef(ref)
      if (!existing) {
        results.push({ ref, status: "not_found" })
        continue
      }

      const changed = await this.episodeStore.tombstoneEpisode(ref)
      if (!changed) {
        results.push({ ref, status: "already_tombstoned" })
        continue
      }

      await this.indexStore.removeEpisode(ref)

      let affectedDerivedRefs: MemoryRef[] | undefined
      if (req.cascadePolicy !== "none") {
        const links = await this.graphStore.fetchProvenanceChain(ref, 8)
        affectedDerivedRefs = links
          .flatMap((link) => [link.from, link.to])
          .filter((candidate) => !(candidate.id === ref.id && candidate.type === ref.type))
      }

      await this.emitEvent("memory.tombstoned", req.scope, {
        ref,
        reason: req.reason,
        cascadePolicy: req.cascadePolicy,
      })

      results.push({
        ref,
        status: "tombstoned",
        affectedDerivedRefs,
      })
    }

    return { results }
  }
}
