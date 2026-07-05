import type {
  AssembleContextRequest,
  AssembleContextResponse,
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
  MemoryEvent,
  MemoryEventType,
  MemoryRef,
  QueryRequest,
  QueryResponse,
  ReadConsistency,
  SubscribeRequest,
  TombstoneRequest,
  TombstoneResponse,
  WorkingContext,
} from "./types"
import { InMemoryEpisodeStore } from "./stores/episode-store"
import { InMemoryGraphStore } from "./stores/graph-store"
import { InMemoryIndexStore } from "./stores/index-store"
import { InMemoryMetadataStore } from "./stores/metadata-store"

const approximateTokens = (value: unknown): number => {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return Math.ceil(text.length / 4)
}

const scopeEqual = (a: { tenantId: string; namespaceId: string }, b: { tenantId: string; namespaceId: string }): boolean =>
  a.tenantId === b.tenantId && a.namespaceId === b.namespaceId

export class InMemoryRuntime {
  readonly episodes = new InMemoryEpisodeStore()
  readonly graph = new InMemoryGraphStore()
  readonly index = new InMemoryIndexStore()
  readonly metadata = new InMemoryMetadataStore()

  ingest(request: IngestRequest): IngestResponse {
    const consistency = request.consistency ?? "accepted"
    const results: IngestResponse["results"] = []

    for (const input of request.episodes) {
      if (!request.scope.tenantId || !request.scope.namespaceId) {
        results.push({
          ref: { id: "invalid", type: "episode", scope: request.scope },
          status: "rejected",
          error: { code: "invalid_scope", message: "scope is required", retryable: false },
        })
        continue
      }

      if (input.dedupeKey) {
        if (this.episodes.hasDedupeConflict(request.scope, input.dedupeKey, input.content)) {
          results.push({
            ref: { id: "conflict", type: "episode", scope: request.scope },
            status: "rejected",
            error: {
              code: "dedupe_conflict",
              message: "dedupe key matches different content",
              retryable: false,
            },
          })
          continue
        }

        const existing = this.episodes.resolveDedupe(request.scope, input.dedupeKey)
        if (existing) {
          results.push({ ref: existing.ref, status: "deduplicated" })
          continue
        }
      }

      const episode = this.episodes.append({
        scope: request.scope,
        createdBy: input.createdBy,
        dedupeKey: input.dedupeKey,
        contentType: input.contentType,
        content: input.content,
        metadata: input.metadata ?? {},
      })

      if (consistency === "indexed") {
        this.index.indexEpisode(episode)
      } else {
        this.index.indexEpisode(episode)
      }

      const ref = this.episodes.toRef(episode)
      results.push({ ref, status: "created" })
      this.publishEvent("episode.ingested", request.scope, { ref })
      this.publishEvent("memory.indexed", request.scope, { ref })
    }

    return { results }
  }

  query(request: QueryRequest): QueryResponse {
    const consistency: ReadConsistency = request.consistency ?? "eventual"
    const result = this.index.search({
      scope: request.scope,
      query: request.query,
      limit: request.limit ?? 20,
      consistency,
    })

    const refs = result.refs.filter((item) => {
      if (request.filters?.includeTypes && !request.filters.includeTypes.includes(item.ref.type)) return false
      return true
    })

    return { refs }
  }

  hydrate(request: HydrateRequest): HydrateResponse {
    const objects: DurableMemoryObject[] = []
    const missing: MemoryRef[] = []

    for (const ref of request.refs) {
      if (!scopeEqual(ref.scope, request.scope)) {
        missing.push(ref)
        continue
      }

      if (ref.type === "episode") {
        const episode = this.episodes.findByRef(ref)
        if (!episode || episode.status === "tombstoned") {
          missing.push(ref)
          continue
        }
        objects.push(episode)
        continue
      }

      missing.push(ref)
    }

    return { objects, missing }
  }

  assembleContext(request: AssembleContextRequest): AssembleContextResponse {
    const consistency: ReadConsistency = request.consistency ?? "eventual"
    const queried = this.query({
      scope: request.scope,
      query: request.task,
      filters: request.filters,
      limit: 200,
      consistency,
    })

    const warnings: WorkingContext["warnings"] = []
    const segments: WorkingContext["segments"] = []
    let tokenEstimate = 0

    if (consistency === "eventual") {
      warnings.push({ code: "eventual_consistency", message: "context used eventual consistency" })
    }

    const mustInclude = new Set((request.constraints?.mustIncludeRefs ?? []).map((ref) => ref.id))
    const excluded = new Set((request.constraints?.excludedRefs ?? []).map((ref) => ref.id))

    for (const hit of queried.refs) {
      if (excluded.has(hit.ref.id)) continue

      const hydrated = this.hydrate({ scope: request.scope, refs: [hit.ref], includeProvenance: true })
      if (hydrated.objects.length === 0) {
        warnings.push({ code: "partial_hydration", message: `unable to hydrate ${hit.ref.id}` })
        continue
      }

      const object = hydrated.objects[0]
      if ((object as Episode).status === "disputed" && !request.constraints?.includeDisputed) {
        continue
      }
      if ((object as Episode).status === "superseded" && !request.constraints?.includeSuperseded) {
        continue
      }

      const content = "content" in object ? object.content : object
      const segmentTokens = approximateTokens(content)
      const limit = request.budget.maxTokens - (request.budget.reservedTokens ?? 0)
      const maxSegments = request.constraints?.maxSegments ?? request.budget.maxSegments

      if (tokenEstimate + segmentTokens > limit || (maxSegments && segments.length >= maxSegments)) {
        warnings.push({ code: "truncated", message: "context was truncated by budget" })
        break
      }

      segments.push({
        ref: hit.ref,
        content,
        score: hit.score,
        reason: hit.reason ?? "selected",
        provenance: undefined,
      })
      tokenEstimate += segmentTokens
      mustInclude.delete(hit.ref.id)
    }

    if (segments.length === 0) {
      warnings.push({ code: "empty_context", message: "no memory matched for context assembly" })
    }

    if (mustInclude.size > 0) {
      warnings.push({
        code: "required_ref_omitted",
        message: `required refs omitted: ${Array.from(mustInclude).join(",")}`,
      })
    }

    return {
      context: {
        scope: request.scope,
        task: request.task,
        budget: request.budget,
        segments,
        tokenEstimate,
        truncated: warnings.some((warning) => warning.code === "truncated"),
        warnings,
        generatedAt: new Date().toISOString(),
      },
    }
  }

  consolidate(request: ConsolidateRequest): ConsolidateResponse {
    const mode = request.mode ?? "enqueue"
    const initialStatus = mode === "run_now" ? "running" : "queued"
    const job = this.metadata.createJob({ scope: request.scope, type: "consolidation", status: initialStatus })

    this.publishEvent("consolidation.started", request.scope, { jobId: job.jobId, trigger: request.trigger })

    if (mode === "run_now") {
      this.metadata.updateJob(job.jobId, "completed", { consolidatedRefs: [] })
      this.publishEvent("consolidation.completed", request.scope, { jobId: job.jobId })
      return { jobId: job.jobId, status: "completed" }
    }

    return { jobId: job.jobId, status: "queued" }
  }

  tombstone(request: TombstoneRequest): TombstoneResponse {
    const results: TombstoneResponse["results"] = []

    for (const ref of request.refs) {
      if (!scopeEqual(ref.scope, request.scope)) {
        results.push({
          ref,
          status: "rejected",
          error: { code: "scope_mismatch", message: "ref scope mismatch", retryable: false },
        })
        continue
      }

      if (ref.type === "episode") {
        const state = this.episodes.tombstone(ref)
        if (state === "not_found") {
          results.push({ ref, status: "not_found" })
          continue
        }
        if (state === "already_tombstoned") {
          results.push({ ref, status: "already_tombstoned" })
          continue
        }

        this.index.tombstone(ref)
        this.publishEvent("memory.tombstoned", request.scope, {
          ref,
          cascadePolicy: request.cascadePolicy,
          reason: request.reason,
        })

        results.push({ ref, status: "tombstoned", affectedDerivedRefs: [] })
        continue
      }

      results.push({ ref, status: "not_found" })
    }

    return { results }
  }

  subscribe(request: SubscribeRequest): { events: MemoryEvent[]; cursor?: string } {
    return this.metadata.listEvents({
      scope: request.scope,
      eventTypes: request.eventTypes,
      cursor: request.cursor,
    })
  }

  getJob(request: GetJobRequest): GetJobResponse {
    const job = this.metadata.getJob(request.scope, request.jobId)
    if (!job) {
      throw new Error("job not found")
    }
    return job
  }

  private publishEvent(type: MemoryEventType, scope: MemoryRef["scope"], payload: Record<string, unknown>): void {
    this.metadata.appendEvent({ type, scope, payload })
  }
}
