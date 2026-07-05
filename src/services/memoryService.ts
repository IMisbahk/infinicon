import {
  ValidationError,
  validateAssembleContextRequest,
  validateConsolidateRequest,
  validateGetJobRequest,
  validateHydrateRequest,
  validateIngestRequest,
  validateQueryRequest,
  validateSubscribeRequest,
  validateTombstoneRequest,
} from "../domain/validation"
import type {
  AssembleContextResponse,
  ConsolidateResponse,
  ContextSegment,
  DurableMemoryObject,
  GetJobResponse,
  HydrateResponse,
  IngestResponse,
  QueryResponse,
  SubscribeResponse,
  TombstoneResponse,
} from "../domain/types"
import type { JobRecord, StoragePorts } from "../storage/ports"

const now = (): string => new Date().toISOString()

const createId = (prefix: string): string => {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${random}`
}

const estimateTokens = (text: string): number => {
  if (!text) {
    return 0
  }
  return Math.ceil(text.length / 4)
}

const getScopeKey = (scope: { tenantId: string; namespaceId: string }): string => {
  return `${scope.tenantId}:${scope.namespaceId}`
}

export class MemoryService {
  constructor(private readonly storage: StoragePorts) {}

  async ingest(raw: unknown): Promise<IngestResponse> {
    const request = validateIngestRequest(raw)
    const results: IngestResponse["results"] = []

    for (const episode of request.episodes) {
      const existing = await this.storage.episodes.findByDedupeKey(request.scope, episode.dedupeKey)

      if (existing) {
        results.push({
          ref: {
            id: existing.id,
            type: "episode",
            scope: request.scope,
          },
          status: "deduplicated",
        })
        continue
      }

      const created: DurableMemoryObject & { type: "episode"; dedupeKey: string } = {
        id: createId("ep"),
        type: "episode",
        scope: request.scope,
        createdAt: now(),
        createdBy: episode.createdBy,
        status: "active",
        metadata: episode.metadata,
        content: episode.content,
        dedupeKey: episode.dedupeKey,
      }

      await this.storage.episodes.append(created)

      const indexedText = typeof episode.content === "string" ? episode.content : JSON.stringify(episode.content)
      await this.storage.index.index(request.scope, {
        ref: { id: created.id, type: "episode", scope: request.scope },
        text: indexedText,
        status: "active",
        updatedAt: now(),
      })

      results.push({
        ref: {
          id: created.id,
          type: "episode",
          scope: request.scope,
        },
        status: "created",
      })
    }

    return { results }
  }

  async query(raw: unknown): Promise<QueryResponse> {
    const request = validateQueryRequest(raw)
    const limit = request.limit ?? 10
    const candidates = await this.storage.index.search(request.scope, request.query, limit)

    return {
      refs: candidates.map((item) => ({
        ref: item.ref,
        score: item.score,
        reason: "Matched indexed episode content",
      })),
    }
  }

  async hydrate(raw: unknown): Promise<HydrateResponse> {
    const request = validateHydrateRequest(raw)

    const objects = await this.storage.episodes.findByRefs(request.scope, request.refs)
    const foundIds = new Set(objects.map((obj) => obj.id))

    const missing = request.refs.filter((ref) => !foundIds.has(ref.id))

    return {
      objects,
      missing,
    }
  }

  async assembleContext(raw: unknown): Promise<AssembleContextResponse> {
    const request = validateAssembleContextRequest(raw)

    const queryResults = await this.storage.index.search(request.scope, request.task, request.budget.maxSegments ?? 8)
    const refs = queryResults.map((item) => item.ref)
    const objects = await this.storage.episodes.findByRefs(request.scope, refs)

    const segments: ContextSegment[] = objects.map((object, index) => {
      const content = typeof object.content === "string" ? object.content : JSON.stringify(object.content)
      return {
        ref: { id: object.id, type: object.type, scope: object.scope },
        content,
        score: queryResults[index]?.score ?? 0,
        reason: "Relevant to task query",
        provenance: {
          sourceRefs: [{ id: object.id, type: object.type }],
        },
      }
    })

    const maxTokens = request.budget.maxTokens
    const selected: ContextSegment[] = []
    let tokenEstimate = 0

    for (const segment of segments) {
      const segmentTokens = estimateTokens(segment.content)
      if (tokenEstimate + segmentTokens > maxTokens) {
        break
      }
      selected.push(segment)
      tokenEstimate += segmentTokens
    }

    const warnings: AssembleContextResponse["context"]["warnings"] = []
    if (selected.length === 0) {
      warnings.push({ code: "empty_context", message: "No eligible memory matched task" })
    }
    if (selected.length < segments.length) {
      warnings.push({ code: "truncated", message: "Context budget truncated candidate set" })
    }
    if (request.consistency === "eventual") {
      warnings.push({ code: "eventual_consistency", message: "Assembly used eventual consistency" })
    }

    return {
      context: {
        scope: request.scope,
        task: request.task,
        budget: request.budget,
        segments: selected,
        tokenEstimate,
        truncated: selected.length < segments.length,
        warnings,
        generatedAt: now(),
      },
    }
  }

  async consolidate(raw: unknown): Promise<ConsolidateResponse> {
    const request = validateConsolidateRequest(raw)

    const job: JobRecord = {
      jobId: createId("job"),
      scope: request.scope,
      type: "consolidate",
      status: request.mode === "run_now" ? "running" : "queued",
      createdAt: now(),
      updatedAt: now(),
      result: {
        trigger: request.trigger,
        mode: request.mode ?? "enqueue",
      },
    }

    if (request.mode === "run_now") {
      job.status = "completed"
      job.updatedAt = now()
    }

    await this.storage.metadata.putJob(job)

    return {
      jobId: job.jobId,
      status: job.status === "queued" ? "queued" : job.status === "running" ? "running" : "completed",
    }
  }

  async tombstone(raw: unknown): Promise<TombstoneResponse> {
    const request = validateTombstoneRequest(raw)
    const results: TombstoneResponse["results"] = []

    for (const ref of request.refs) {
      if (ref.type !== "episode") {
        results.push({
          ref,
          status: "rejected",
          error: {
            code: "unsupported_ref_type",
            message: "only episode tombstones are implemented in v0 skeleton",
            retryable: false,
          },
        })
        continue
      }

      const existing = await this.storage.episodes.findByRef(request.scope, ref)
      if (!existing) {
        results.push({ ref, status: "not_found" })
        continue
      }

      const changed = await this.storage.episodes.tombstone(request.scope, ref)
      await this.storage.index.remove(request.scope, ref)

      results.push({
        ref,
        status: changed ? "tombstoned" : "already_tombstoned",
      })
    }

    return { results }
  }

  async subscribe(raw: unknown): Promise<SubscribeResponse> {
    const request = validateSubscribeRequest(raw)

    return {
      subscriptionId: createId(`sub_${getScopeKey(request.scope).replace(":", "_")}`),
      accepted: true,
      cursor: request.cursor,
    }
  }

  async getJob(raw: unknown): Promise<GetJobResponse> {
    const request = validateGetJobRequest(raw)
    const job = await this.storage.metadata.getJob(request.scope, request.jobId)

    if (!job) {
      return {
        jobId: request.jobId,
        type: "unknown",
        status: "failed",
        createdAt: now(),
        updatedAt: now(),
        error: {
          code: "job_not_found",
          message: "job not found in scope",
          retryable: false,
        },
      }
    }

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
}

export const toHttpError = (error: unknown): { status: number; body: Record<string, unknown> } => {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        code: "invalid_request",
        message: error.message,
      },
    }
  }

  return {
    status: 500,
    body: {
      code: "internal_error",
      message: "unexpected runtime error",
    },
  }
}
