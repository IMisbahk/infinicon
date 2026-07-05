import type {
  ApiResult,
  AssembleContextRequest,
  AssembleContextResponse,
  ConsolidateRequest,
  ConsolidateResponse,
  ContextWarning,
  DurableMemoryObject,
  GetJobRequest,
  GetJobResponse,
  HydrateRequest,
  HydrateResponse,
  IngestRequest,
  IngestResponse,
  MemoryEvent,
  MemoryEventType,
  MemoryFilters,
  MemoryRef,
  QueryRequest,
  QueryResponse,
  SubscribeRequest,
  SubscribeResponse,
  TombstoneRequest,
  TombstoneResponse,
} from "./types"
import type {
  EpisodeObject,
  EpisodeStore,
  GraphStore,
  IndexStore,
  LinkObject,
  MetadataStore,
} from "./ports"
import { containsQuery, estimateTokens, nowIso, refKey } from "./utils"

export type RuntimeDeps = {
  episodeStore: EpisodeStore
  graphStore: GraphStore
  indexStore: IndexStore
  metadataStore: MetadataStore
}

type Subscription = {
  id: string
  scopeKey: string
  eventTypes?: Set<MemoryEventType>
  events: MemoryEvent[]
}

export class MemoryRuntimeService {
  private subscriptions = new Map<string, Subscription>()

  constructor(private deps: RuntimeDeps) {}

  async ingest(request: IngestRequest): Promise<ApiResult<IngestResponse>> {
    if (!request.episodes.length) {
      return this.error("invalid_request", "episodes must be non-empty", false)
    }

    const results: IngestResponse["results"] = []

    for (const episode of request.episodes) {
      const existing = await this.deps.episodeStore.resolveByDedupeKey(request.scope, episode.dedupeKey)
      if (existing) {
        const existingRef: MemoryRef = { id: existing.id, type: "episode", scope: existing.scope }
        results.push({ ref: existingRef, status: "deduplicated" })
        continue
      }

      const id = await this.deps.metadataStore.nextCursor(request.scope, "episode")
      const now = nowIso()
      const created: EpisodeObject = {
        id,
        type: "episode",
        scope: request.scope,
        status: "active",
        createdAt: now,
        createdBy: episode.createdBy,
        dedupeKey: episode.dedupeKey,
        contentType: episode.contentType,
        content: episode.content,
        metadata: episode.metadata,
      }

      await this.deps.episodeStore.appendEpisode(created)
      await this.deps.metadataStore.putObject(created)

      const ref: MemoryRef = { id, type: "episode", scope: request.scope }
      await this.deps.indexStore.index({
        ref,
        searchableText: typeof episode.content === "string" ? episode.content : JSON.stringify(episode.content),
        indexedAt: now,
      })

      await this.emitEvent("episode.ingested", request.scope, ref)
      await this.emitEvent("memory.indexed", request.scope, ref)

      results.push({ ref, status: "created" })
    }

    return { ok: true, value: { results } }
  }

  async query(request: QueryRequest): Promise<ApiResult<QueryResponse>> {
    const limit = Math.max(1, request.limit ?? 20)
    const candidates = await this.deps.indexStore.search(request.scope, request.query, limit * 3)
    const refs: QueryResponse["refs"] = []

    for (const candidate of candidates) {
      const object = await this.deps.metadataStore.getObject(candidate.ref)
      if (!object) continue
      if (!this.includeByStatus(object, request.filters)) continue

      refs.push({
        ref: candidate.ref,
        score: candidate.score,
        reason: candidate.reason,
        warnings: this.warningsForObject(object, request.consistency),
      })

      if (refs.length >= limit) break
    }

    return { ok: true, value: { refs } }
  }

  async hydrate(request: HydrateRequest): Promise<ApiResult<HydrateResponse>> {
    const objects = await this.deps.metadataStore.getObjects(request.refs)
    const hydrated: DurableMemoryObject[] = []
    const missing: MemoryRef[] = []

    objects.forEach((object, index) => {
      const ref = request.refs[index]
      if (!object || object.status === "tombstoned") {
        missing.push(ref)
        return
      }
      hydrated.push(object)
    })

    return { ok: true, value: { objects: hydrated, missing } }
  }

  async assembleContext(request: AssembleContextRequest): Promise<ApiResult<AssembleContextResponse>> {
    const queryResult = await this.query({
      scope: request.scope,
      query: request.task,
      filters: request.filters,
      limit: request.budget.maxSegments ?? request.constraints?.maxSegments ?? 20,
      consistency: request.consistency,
    })

    if (!queryResult.ok) return queryResult

    const refs = queryResult.value.refs.map(item => item.ref)
    const hydrateResult = await this.hydrate({ scope: request.scope, refs, includeProvenance: true })
    if (!hydrateResult.ok) return hydrateResult

    const maxTokens = request.budget.maxTokens - (request.budget.reservedTokens ?? 0)
    let consumed = 0
    let truncated = false
    const warnings: ContextWarning[] = []

    const segments: AssembleContextResponse["context"]["segments"] = []

    for (const object of hydrateResult.value.objects) {
      const content = object.content ?? object.metadata ?? object
      const tokenEstimate = estimateTokens(content)
      if (consumed + tokenEstimate > maxTokens) {
        truncated = true
        continue
      }

      consumed += tokenEstimate
      const ref: MemoryRef = { id: object.id, type: object.type, scope: object.scope }
      const score = this.scoreForTask(content, request.task)
      segments.push({
        ref,
        content,
        score,
        reason: "matched task query",
        provenance: (object.provenance as Record<string, unknown> | undefined) ?? {},
      })
    }

    if (!segments.length) {
      warnings.push({ code: "empty_context", message: "no matching memory" })
    }
    if (truncated) {
      warnings.push({ code: "truncated", message: "context budget exceeded" })
    }
    if (request.consistency === "eventual") {
      warnings.push({ code: "eventual_consistency", message: "eventual consistency requested" })
    }
    if (hydrateResult.value.missing.length) {
      warnings.push({ code: "partial_hydration", message: "some refs could not be hydrated" })
    }

    return {
      ok: true,
      value: {
        context: {
          scope: request.scope,
          task: request.task,
          budget: request.budget,
          segments,
          tokenEstimate: consumed,
          truncated,
          warnings,
          generatedAt: nowIso(),
        },
      },
    }
  }

  async consolidate(request: ConsolidateRequest): Promise<ApiResult<ConsolidateResponse>> {
    const jobId = await this.deps.metadataStore.nextCursor(request.scope, "job")
    const created = await this.deps.metadataStore.createJob({
      jobId,
      type: "consolidation",
      status: request.mode === "run_now" ? "running" : "queued",
      result: { scope: request.scope, trigger: request.trigger },
    })

    await this.emitEvent("consolidation.started", request.scope)

    if (request.mode === "run_now") {
      await this.deps.metadataStore.updateJob(created.jobId, job => ({ ...job, status: "completed" }))
      await this.emitEvent("consolidation.completed", request.scope)
      return { ok: true, value: { jobId: created.jobId, status: "completed" } }
    }

    return { ok: true, value: { jobId: created.jobId, status: "queued" } }
  }

  async tombstone(request: TombstoneRequest): Promise<ApiResult<TombstoneResponse>> {
    const results: TombstoneResponse["results"] = []

    for (const ref of request.refs) {
      const object = await this.deps.metadataStore.getObject(ref)
      if (!object) {
        results.push({ ref, status: "not_found" })
        continue
      }

      if (object.status === "tombstoned") {
        results.push({ ref, status: "already_tombstoned" })
        continue
      }

      object.status = "tombstoned"
      object.updatedAt = nowIso()
      await this.deps.metadataStore.putObject(object)
      await this.deps.indexStore.remove(ref)

      if (ref.type === "episode") {
        await this.deps.episodeStore.tombstone(ref)
      }

      const affectedDerivedRefs: MemoryRef[] = []
      if (request.cascadePolicy !== "none") {
        const incoming = await this.deps.graphStore.incoming(ref)
        for (const link of incoming) {
          if (link.linkType !== "derived_from") continue
          const derived = link.from
          const derivedObject = await this.deps.metadataStore.getObject(derived)
          if (!derivedObject) continue

          if (request.cascadePolicy === "mark_derived_stale") {
            if (derivedObject.status === "active") {
              derivedObject.status = "disputed"
              derivedObject.updatedAt = nowIso()
              await this.deps.metadataStore.putObject(derivedObject)
            }
            affectedDerivedRefs.push(derived)
            continue
          }

          if (request.cascadePolicy === "tombstone_derived") {
            derivedObject.status = "tombstoned"
            derivedObject.updatedAt = nowIso()
            await this.deps.metadataStore.putObject(derivedObject)
            await this.deps.indexStore.remove(derived)
            affectedDerivedRefs.push(derived)
          }
        }
      }

      await this.emitEvent("memory.tombstoned", request.scope, ref)
      results.push({ ref, status: "tombstoned", affectedDerivedRefs: affectedDerivedRefs.length ? affectedDerivedRefs : undefined })
    }

    return { ok: true, value: { results } }
  }

  async subscribe(request: SubscribeRequest): Promise<ApiResult<SubscribeResponse>> {
    const id = await this.deps.metadataStore.nextCursor(request.scope, "event")
    const types = request.eventTypes?.length ? new Set(request.eventTypes) : undefined

    this.subscriptions.set(id, {
      id,
      scopeKey: this.scopeEventKey(request.scope),
      eventTypes: types,
      events: [],
    })

    return { ok: true, value: { subscriptionId: id } }
  }

  async getSubscriptionEvents(subscriptionId: string): Promise<MemoryEvent[]> {
    return this.subscriptions.get(subscriptionId)?.events ?? []
  }

  async getJob(request: GetJobRequest): Promise<ApiResult<GetJobResponse>> {
    const job = await this.deps.metadataStore.getJob(request.scope, request.jobId)
    if (!job) return this.error("not_found", "job not found", false)
    return { ok: true, value: job }
  }

  // bad workaround - keep filtering centralized until dedicated policy module lands
  private includeByStatus(object: DurableMemoryObject, filters?: MemoryFilters): boolean {
    if (object.status === "tombstoned") return false
    if (object.status === "disputed" && !filters?.includeDisputed) return false
    if (object.status === "superseded" && !filters?.includeSuperseded) return false
    return true
  }

  private warningsForObject(object: DurableMemoryObject, consistency?: "strong" | "eventual"): ContextWarning[] {
    const warnings: ContextWarning[] = []
    if (object.status === "disputed") warnings.push({ code: "disputed_memory_included", message: "disputed memory included" })
    if (object.status === "superseded") warnings.push({ code: "superseded_memory_included", message: "superseded memory included" })
    if (consistency === "eventual") warnings.push({ code: "eventual_consistency", message: "eventual consistency requested" })
    return warnings
  }

  private scoreForTask(content: unknown, task: string): number {
    if (containsQuery(content, task)) return 0.95
    const text = typeof content === "string" ? content : JSON.stringify(content)
    const overlap = task
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .filter(token => text.toLowerCase().includes(token))
    return Math.max(0.1, Math.min(0.9, overlap.length / Math.max(1, task.split(/\s+/).length)))
  }

  private async emitEvent(type: MemoryEventType, scope: MemoryRef["scope"], ref?: MemoryRef): Promise<void> {
    const cursor = await this.deps.metadataStore.nextCursor(scope, "event")
    const event: MemoryEvent = {
      type,
      scope,
      ref,
      cursor,
      emittedAt: nowIso(),
    }

    const key = this.scopeEventKey(scope)
    for (const subscription of this.subscriptions.values()) {
      if (subscription.scopeKey !== key) continue
      if (subscription.eventTypes && !subscription.eventTypes.has(type)) continue
      subscription.events.push(event)
    }
  }

  private scopeEventKey(scope: MemoryRef["scope"]): string {
    return `${scope.tenantId}::${scope.namespaceId}`
  }

  private error<T>(code: string, message: string, retryable: boolean): ApiResult<T> {
    return {
      ok: false,
      error: { code, message, retryable },
    }
  }
}

export async function createDerivedLink(graphStore: GraphStore, scope: MemoryRef["scope"], from: MemoryRef, to: MemoryRef): Promise<LinkObject> {
  const id = `${from.id}_derived_from_${to.id}`
  const link: LinkObject = {
    id,
    type: "link",
    scope,
    status: "active",
    createdAt: nowIso(),
    linkType: "derived_from",
    from,
    to,
    metadata: {},
    createdBy: "runtime",
  }

  await graphStore.addLink(link)
  return link
}
