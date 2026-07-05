import type {
  AssembleContextRequest,
  AssembleContextResponse,
  ContextWarning,
  ConsolidateRequest,
  ConsolidateResponse,
  DurableMemoryObject,
  Episode,
  GetJobRequest,
  GetJobResponse,
  HydrateRequest,
  HydrateResponse,
  IngestRequest,
  IngestResponse,
  MemoryApiError,
  MemoryEventType,
  MemoryRef,
  QueryRequest,
  QueryResponse,
  Scope,
  SubscribeRequest,
  SubscribeResponse,
  TombstoneRequest,
  TombstoneResponse,
} from "./types"
import type { EpisodeStore, GraphStore, IndexStore, MetadataStore } from "./ports"
import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
} from "./inmemory/stores"

const sameScope = (a: Scope, b: Scope): boolean =>
  a.tenantId === b.tenantId &&
  a.namespaceId === b.namespaceId &&
  (a.agentId ?? "") === (b.agentId ?? "") &&
  (a.sessionId ?? "") === (b.sessionId ?? "")

const serializeComparable = (value: unknown): string => JSON.stringify(value)

const makeError = (code: string, message: string, retryable = false): MemoryApiError => ({
  code,
  message,
  retryable,
})

const nowIso = (): string => new Date().toISOString()

export type RuntimeAuthContext = {
  action:
    | "ingest"
    | "query"
    | "hydrate"
    | "assembleContext"
    | "consolidate"
    | "tombstone"
    | "subscribe"
    | "readLifecycleEventsFromCursor"
    | "getJob"
  scope: Scope
}

export type RuntimeDeps = {
  episodeStore: EpisodeStore
  graphStore: GraphStore
  indexStore: IndexStore
  metadataStore: MetadataStore
  authorize?: (input: RuntimeAuthContext) => Promise<boolean> | boolean
  supportsStrongSubscribeConsistency?: boolean
}

type JobRecord = {
  jobId: string
  type: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  scope: Scope
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: MemoryApiError
}

export class InfiniconRuntime {
  private idCounter = 0
  private readonly jobs = new Map<string, JobRecord>()
  private readonly supportsStrongSubscribeConsistency: boolean

  constructor(private readonly deps: RuntimeDeps) {
    this.supportsStrongSubscribeConsistency = deps.supportsStrongSubscribeConsistency ?? true
  }

  private nextId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}_${this.idCounter}`
  }

  private async assertAuthorized(action: RuntimeAuthContext["action"], scope: Scope): Promise<void> {
    if (!this.deps.authorize) return
    const allowed = await this.deps.authorize({ action, scope })
    if (!allowed) {
      throw makeError("unauthorized", `Not authorized for ${action} in requested scope`, false)
    }
  }

  private async emitEvent(input: {
    type: MemoryEventType
    scope: Scope
    ref?: MemoryRef
    jobId?: string
    metadata?: Record<string, unknown>
  }): Promise<void> {
    const eventBase = {
      type: input.type,
      scope: input.scope,
      occurredAt: nowIso(),
    }
    const withRef = input.ref ? { ...eventBase, ref: input.ref } : eventBase
    const withJob = input.jobId ? { ...withRef, jobId: input.jobId } : withRef
    const payload = input.metadata ? { ...withJob, metadata: input.metadata } : withJob
    await this.deps.metadataStore.appendLifecycleEvent(payload)
  }

  async ingest(request: IngestRequest): Promise<IngestResponse> {
    await this.assertAuthorized("ingest", request.scope)

    const results: IngestResponse["results"] = []

    for (const incoming of request.episodes) {
      if (incoming.dedupeKey) {
        const existingRef = await this.deps.episodeStore.resolveDedupeKey(request.scope, incoming.dedupeKey)
        if (existingRef) {
          const existing = await this.deps.episodeStore.getEpisode(existingRef)
          if (!existing) {
            results.push({
              ref: existingRef,
              status: "rejected",
              error: makeError("dedupe_state_corrupt", "Dedupe key resolved to missing episode", false),
            })
            continue
          }

          const contentMatches =
            serializeComparable(existing.content) === serializeComparable(incoming.content) &&
            existing.contentType === incoming.contentType

          if (!contentMatches) {
            results.push({
              ref: existingRef,
              status: "rejected",
              error: makeError(
                "dedupe_conflict",
                "Dedupe key already exists with different content in this scope",
                false,
              ),
            })
            continue
          }

          results.push({ ref: existingRef, status: "deduplicated" })
          continue
        }
      }

      const episodeBase = {
        id: this.nextId("ep"),
        type: "episode" as const,
        scope: request.scope,
        createdAt: nowIso(),
        createdBy: incoming.createdBy,
        status: "active" as const,
        metadata: incoming.metadata ?? {},
        contentType: incoming.contentType,
        content: incoming.content,
      }
      const episode: Episode = incoming.dedupeKey
        ? { ...episodeBase, dedupeKey: incoming.dedupeKey }
        : episodeBase

      await this.deps.episodeStore.appendEpisode(episode)
      await this.deps.indexStore.indexMemory(episode)

      const ref: MemoryRef = { id: episode.id, type: "episode", scope: request.scope }
      await this.emitEvent({ type: "episode.ingested", scope: request.scope, ref })
      await this.emitEvent({ type: "memory.indexed", scope: request.scope, ref })

      results.push({ ref, status: "created" })
    }

    return { results }
  }

  async query(request: QueryRequest): Promise<QueryResponse> {
    await this.assertAuthorized("query", request.scope)

    const limit = request.limit ?? 20
    const refs = await this.deps.indexStore.search(request.scope, request.query, limit)
    return {
      refs: refs.map((item) => {
        const base = {
          ref: item.ref,
          score: item.score,
        }
        return item.reason ? { ...base, reason: item.reason } : base
      }),
    }
  }

  async hydrate(request: HydrateRequest): Promise<HydrateResponse> {
    await this.assertAuthorized("hydrate", request.scope)

    const objects: DurableMemoryObject[] = []
    const missing: MemoryRef[] = []

    for (const ref of request.refs) {
      if (!sameScope(ref.scope, request.scope)) {
        missing.push(ref)
        continue
      }
      if (ref.type !== "episode") {
        missing.push(ref)
        continue
      }
      const episode = await this.deps.episodeStore.getEpisode(ref)
      if (!episode || episode.status === "tombstoned") {
        missing.push(ref)
        continue
      }
      objects.push(episode)
    }

    return { objects, missing }
  }

  async assembleContext(request: AssembleContextRequest): Promise<AssembleContextResponse> {
    await this.assertAuthorized("assembleContext", request.scope)

    const queryRequest: QueryRequest = {
      scope: request.scope,
      query: request.task,
      limit: request.constraints?.maxSegments ?? request.budget.maxSegments ?? 20,
    }
    if (request.consistency) {
      queryRequest.consistency = request.consistency
    }
    if (request.filters) {
      queryRequest.filters = request.filters
    }

    const candidateRefs = await this.query(queryRequest)

    const hydrated = await this.hydrate({
      scope: request.scope,
      refs: candidateRefs.refs.map((item) => item.ref),
      includeProvenance: false,
    })

    const segments = hydrated.objects.map((obj) => {
      const score = candidateRefs.refs.find((item) => item.ref.id === obj.id)?.score ?? 0
      return {
        ref: { id: obj.id, type: obj.type, scope: obj.scope },
        content: obj.content,
        score,
        reason: "retrieved_for_task",
      }
    })

    const maxSegments = request.budget.maxSegments ?? request.constraints?.maxSegments
    const boundedSegments = typeof maxSegments === "number" ? segments.slice(0, maxSegments) : segments

    const tokenEstimate = Math.ceil(
      boundedSegments.reduce((total, segment) => total + JSON.stringify(segment.content).length / 4, 0),
    )

    const warnings: ContextWarning[] = []
    const truncated = segments.length > boundedSegments.length || tokenEstimate > request.budget.maxTokenEstimate

    if (boundedSegments.length === 0) {
      warnings.push("empty_context")
    }
    if (truncated) {
      warnings.push("truncated")
    }
    if (request.consistency === "eventual") {
      warnings.push("eventual_consistency")
    }

    return {
      context: {
        scope: request.scope,
        task: request.task,
        budget: request.budget,
        segments: boundedSegments,
        tokenEstimate: Math.min(tokenEstimate, request.budget.maxTokenEstimate),
        truncated,
        warnings,
        generatedAt: nowIso(),
      },
    }
  }

  async consolidate(request: ConsolidateRequest): Promise<ConsolidateResponse> {
    await this.assertAuthorized("consolidate", request.scope)

    const jobId = this.nextId("job")
    const createdAt = nowIso()

    const queued: JobRecord = {
      jobId,
      type: "consolidation",
      status: "queued",
      scope: request.scope,
      createdAt,
      updatedAt: createdAt,
    }
    this.jobs.set(jobId, queued)

    if (request.mode === "run_now") {
      const running: JobRecord = {
        ...queued,
        status: "running",
        updatedAt: nowIso(),
      }
      this.jobs.set(jobId, running)

      const completed: JobRecord = {
        ...running,
        status: "completed",
        updatedAt: nowIso(),
        result: {
          trigger: request.trigger,
          message: "consolidation skeleton completed",
        },
      }
      this.jobs.set(jobId, completed)
      await this.emitEvent({ type: "consolidation.started", scope: request.scope, jobId })
      await this.emitEvent({ type: "consolidation.completed", scope: request.scope, jobId })

      return {
        jobId,
        status: "completed",
      }
    }

    return {
      jobId,
      status: "queued",
    }
  }

  async tombstone(request: TombstoneRequest): Promise<TombstoneResponse> {
    await this.assertAuthorized("tombstone", request.scope)

    const results: TombstoneResponse["results"] = []

    for (const ref of request.refs) {
      if (!sameScope(ref.scope, request.scope)) {
        results.push({
          ref,
          status: "rejected",
          error: makeError("scope_mismatch", "Ref scope does not match request scope", false),
        })
        continue
      }

      if (ref.type !== "episode") {
        results.push({
          ref,
          status: "rejected",
          error: makeError("unsupported_ref_type", "Only episode tombstoning is implemented in v0 skeleton", false),
        })
        continue
      }

      const outcome = await this.deps.episodeStore.tombstoneEpisode(ref)
      if (outcome === "tombstoned") {
        await this.deps.indexStore.removeMemory(ref)
        await this.emitEvent({ type: "memory.tombstoned", scope: request.scope, ref })
      }

      results.push({
        ref,
        status: outcome,
      })
    }

    return { results }
  }

  async subscribe(request: SubscribeRequest): Promise<SubscribeResponse> {
    await this.assertAuthorized("subscribe", request.scope)

    if (request.consistency === "strong" && !this.supportsStrongSubscribeConsistency) {
      throw makeError(
        "consistency_not_supported",
        "Strong subscription consistency is not supported by the active runtime configuration",
        false,
      )
    }

    if (request.cursor) {
      const cursorInScope = await this.deps.metadataStore.isCursorValidForScope(request.scope, request.cursor)
      if (!cursorInScope) {
        const hasCursorInAnyScope = await this.deps.metadataStore.isCursorKnown(request.cursor)
        if (hasCursorInAnyScope) {
          throw makeError("scope_mismatch", "Cursor does not belong to the requested scope", false)
        }
        throw makeError("invalid_cursor", "Supplied cursor is unknown, expired, or malformed", false)
      }
    }

    await this.assertAuthorized("readLifecycleEventsFromCursor", request.scope)

    const cursorRequest = request.cursor
      ? { scope: request.scope, cursor: request.cursor, limit: 200 }
      : { scope: request.scope, limit: 200 }
    const cursorRequestWithTypes = request.eventTypes?.length
      ? { ...cursorRequest, eventTypes: request.eventTypes }
      : cursorRequest

    const page = await this.deps.metadataStore.readLifecycleEventsFromCursor(cursorRequestWithTypes)

    let events = page.events

    if (request.consistency === "eventual") {
      events = events.map((event) => ({
        ...event,
        warnings: Array.from(new Set([...(event.warnings ?? []), "eventual_consistency"])),
      }))
    }

    const nextCursor = events.at(-1)?.cursor ?? page.nextCursor
    return nextCursor ? { events, nextCursor } : { events }
  }

  async getJob(request: GetJobRequest): Promise<GetJobResponse> {
    await this.assertAuthorized("getJob", request.scope)

    const job = this.jobs.get(request.jobId)
    if (!job) {
      return {
        jobId: request.jobId,
        type: "unknown",
        status: "failed",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        error: makeError("job_not_found", "Requested job does not exist", false),
      }
    }

    if (!sameScope(job.scope, request.scope)) {
      return {
        jobId: request.jobId,
        type: job.type,
        status: "failed",
        createdAt: job.createdAt,
        updatedAt: nowIso(),
        error: makeError("scope_mismatch", "Requested job is outside the requested scope", false),
      }
    }

    const base = {
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }
    if (job.error && job.result) return { ...base, error: job.error, result: job.result }
    if (job.error) return { ...base, error: job.error }
    if (job.result) return { ...base, result: job.result }
    return base
  }
}

export const createInMemoryRuntime = (deps?: Partial<RuntimeDeps>): InfiniconRuntime => {
  const baseDeps = {
    episodeStore: deps?.episodeStore ?? new InMemoryEpisodeStore(),
    graphStore: deps?.graphStore ?? new InMemoryGraphStore(),
    indexStore: deps?.indexStore ?? new InMemoryIndexStore(),
    metadataStore: deps?.metadataStore ?? new InMemoryMetadataStore(),
  }
  const withAuth = deps?.authorize ? { ...baseDeps, authorize: deps.authorize } : baseDeps
  const runtimeDeps =
    typeof deps?.supportsStrongSubscribeConsistency === "boolean"
      ? { ...withAuth, supportsStrongSubscribeConsistency: deps.supportsStrongSubscribeConsistency }
      : withAuth
  return new InfiniconRuntime(runtimeDeps)
}
