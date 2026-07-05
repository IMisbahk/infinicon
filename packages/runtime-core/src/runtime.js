import {
  assertAssembleContextRequest,
  assertConsolidateRequest,
  assertGetJobRequest,
  assertHydrateRequest,
  assertIngestRequest,
  assertQueryRequest,
  assertSubscribeRequest,
  assertTombstoneRequest,
} from "../../runtime-types/src/api-types.js"
import { cloneScope, createMemoryRef, sameScope } from "../../runtime-types/src/memory-types.js"
import { createWarning } from "../../runtime-types/src/warnings.js"
import { MemoryApiRuntimeError } from "./errors.js"

function nowIso() {
  return new Date().toISOString()
}

function randomId(prefix) {
  const tick = Number(process.hrtime.bigint() % 1000000n)
  const part = `${Date.now()}_${tick}`
  return `${prefix}_${part}`
}

function createEvent(scope, type, payload = {}) {
  return {
    cursor: randomId("evt"),
    type,
    at: nowIso(),
    scope: cloneScope(scope),
    payload,
  }
}

async function appendEvents(metadataStore, scope, events) {
  for (const event of events) {
    await metadataStore.appendEvent(scope, event)
  }
}

function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / 4)
}

function compareSegments(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score
  }
  return String(left.ref.id).localeCompare(String(right.ref.id))
}

function isAllowedByLifecycleStatus(object, filters = {}) {
  if (!object) {
    return false
  }
  if (object.status === "tombstoned") {
    return false
  }
  if (!filters.includeDisputed && object.status === "disputed") {
    return false
  }
  if (!filters.includeSuperseded && object.status === "superseded") {
    return false
  }
  return true
}

export class MemoryRuntime {
  constructor({ episodeStore, graphStore, indexStore, metadataStore }) {
    this.episodeStore = episodeStore
    this.graphStore = graphStore
    this.indexStore = indexStore
    this.metadataStore = metadataStore
  }

  async ingest(request) {
    try {
      assertIngestRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    await this.metadataStore.upsertScope(request.scope)

    const results = []
    for (const incoming of request.episodes) {
      const existing = await this.episodeStore.resolveDedupeKey(request.scope, incoming.dedupeKey)
      if (existing) {
        if (JSON.stringify(existing.content) !== JSON.stringify(incoming.content)) {
          results.push({
            ref: createMemoryRef(existing.id, "episode", cloneScope(existing.scope)),
            status: "rejected",
            error: {
              code: "dedupe_conflict",
              message: "dedupe key matches existing episode with different content",
              retryable: false,
              details: {
                dedupeKey: incoming.dedupeKey,
              },
            },
          })
          continue
        }

        results.push({
          ref: createMemoryRef(existing.id, "episode", cloneScope(existing.scope)),
          status: "deduplicated",
        })
        continue
      }

      const id = randomId("ep")
      const episode = {
        id,
        type: "episode",
        scope: cloneScope(request.scope),
        createdAt: nowIso(),
        createdBy: incoming.createdBy ?? { type: "system", id: "unknown" },
        status: "active",
        dedupeKey: incoming.dedupeKey,
        contentType: incoming.contentType ?? "application/json",
        content: incoming.content,
        metadata: incoming.metadata ?? {},
      }

      await this.episodeStore.appendEpisode(episode)
      await this.indexStore.indexMemoryPayload({
        ref: createMemoryRef(episode.id, "episode", cloneScope(episode.scope)),
        scope: cloneScope(episode.scope),
        status: episode.status,
        text: typeof episode.content === "string" ? episode.content : JSON.stringify(episode.content),
      })

      results.push({
        ref: createMemoryRef(episode.id, "episode", cloneScope(episode.scope)),
        status: "created",
      })
    }

    if (request.consistency === "indexed") {
      const freshness = await this.indexStore.getIndexFreshness(request.scope)
      if (!freshness?.indexedAt) {
        throw new MemoryApiRuntimeError(
          "indexing_unavailable",
          "indexed consistency requested but index freshness unavailable",
          true,
        )
      }
    }

    const ingestEvents = results.map((result) =>
      createEvent(request.scope, "episode.ingested", {
        ref: result.ref,
        status: result.status,
      }),
    )
    await appendEvents(this.metadataStore, request.scope, ingestEvents)

    return { results }
  }

  async query(request) {
    try {
      assertQueryRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    const refs = await this.indexStore.searchByQueryPayload(
      request.scope,
      request.query,
      request.filters,
      request.limit ?? 20,
    )

    const responseRefs = []
    for (const item of refs) {
      if (!sameScope(item.ref.scope, request.scope)) {
        continue
      }
      responseRefs.push({
        ref: item.ref,
        score: item.score,
        reason: item.reason,
        warnings: request.consistency === "eventual" ? [createWarning("eventual_consistency", "eventual consistency mode used")] : [],
      })
    }

    return {
      refs: responseRefs,
      cursor: null,
    }
  }

  async hydrate(request) {
    try {
      assertHydrateRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    const objects = []
    const missing = []

    for (const ref of request.refs) {
      if (!sameScope(ref.scope, request.scope)) {
        missing.push(ref)
        continue
      }
      const object = await this.episodeStore.getEpisodeByRef(ref)
      if (!object) {
        missing.push(ref)
        continue
      }
      if (object.status === "tombstoned" && !request.allowTombstoneAudit) {
        missing.push(ref)
        continue
      }
      objects.push(request.includeProvenance ? { ...object, provenance: object.provenance ?? null } : object)
    }

    return {
      objects,
      missing,
    }
  }

  async assembleContext(request) {
    try {
      assertAssembleContextRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    const warnings = []
    const candidateRefs = await this.indexStore.searchByQueryPayload(
      request.scope,
      request.task,
      request.filters,
      request.constraints?.maxSegments ?? 50,
    )

    const candidateOnly = candidateRefs.map((item) => item.ref)
    const hydrated = await this.hydrate({
      scope: request.scope,
      refs: candidateOnly,
      includeProvenance: true,
    })

    if (hydrated.missing.length > 0) {
      warnings.push(createWarning("partial_hydration", "some candidate refs could not be hydrated", { missing: hydrated.missing.length }))
    }

    const objectById = new Map(hydrated.objects.map((object) => [object.id, object]))
    const allowedSegments = candidateRefs
      .filter((candidate) => objectById.has(candidate.ref.id))
      .map((candidate) => {
        const object = objectById.get(candidate.ref.id)
        return {
          ref: candidate.ref,
          score: candidate.score,
          reason: candidate.reason,
          object,
        }
      })
      .filter((segment) => isAllowedByLifecycleStatus(segment.object, request.filters))

    if (request.filters?.includeDisputed && allowedSegments.some((segment) => segment.object.status === "disputed")) {
      warnings.push(createWarning("disputed_memory_included", "context includes disputed memory"))
    }
    if (request.filters?.includeSuperseded && allowedSegments.some((segment) => segment.object.status === "superseded")) {
      warnings.push(createWarning("superseded_memory_included", "context includes superseded memory"))
    }

    const ordered = allowedSegments.sort(compareSegments)

    const maxTokens = request.budget.maxTokens ?? 1024
    const maxSegments = request.budget.maxSegments ?? ordered.length
    const reservedTokens = request.budget.reservedTokens ?? 0
    const availableTokens = Math.max(0, maxTokens - reservedTokens)

    let runningTokens = 0
    const segments = []

    for (const segment of ordered) {
      if (segments.length >= maxSegments) {
        warnings.push(createWarning("truncated", "segment budget reached", { maxSegments }))
        break
      }
      const content = typeof segment.object.content === "string"
        ? segment.object.content
        : JSON.stringify(segment.object.content)
      const contentTokens = estimateTokens(content)
      if (runningTokens + contentTokens > availableTokens) {
        warnings.push(createWarning("truncated", "token budget reached", { availableTokens }))
        continue
      }
      runningTokens += contentTokens
      segments.push({
        ref: segment.ref,
        content,
        score: segment.score,
        reason: segment.reason,
        provenance: segment.object.provenance ?? null,
      })
    }

    if (request.constraints?.mustIncludeRefs?.length) {
      for (const mustRef of request.constraints.mustIncludeRefs) {
        if (!segments.find((segment) => segment.ref.id === mustRef.id)) {
          warnings.push(createWarning("required_ref_omitted", "required ref was not included in final context", { ref: mustRef }))
        }
      }
    }

    if (segments.length === 0) {
      warnings.push(createWarning("empty_context", "no memory matched context request"))
    }

    if (request.consistency === "eventual") {
      warnings.push(createWarning("eventual_consistency", "eventual consistency mode used"))
    }

    return {
      context: {
        scope: cloneScope(request.scope),
        task: request.task,
        budget: request.budget,
        segments,
        tokenEstimate: runningTokens,
        truncated: warnings.some((warning) => warning.code === "truncated"),
        warnings,
        generatedAt: nowIso(),
      },
    }
  }

  async consolidate(request) {
    try {
      assertConsolidateRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    const jobId = randomId("job_consolidate")
    const job = {
      jobId,
      type: "consolidate",
      scope: cloneScope(request.scope),
      status: request.mode === "run_now" ? "completed" : "queued",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      result: {
        trigger: request.trigger,
        filters: request.filters ?? null,
      },
    }
    await this.metadataStore.saveJob(job)
    await appendEvents(this.metadataStore, request.scope, [
      createEvent(request.scope, "consolidation.started", { jobId }),
      createEvent(request.scope, job.status === "completed" ? "consolidation.completed" : "consolidation.queued", { jobId }),
    ])
    return {
      jobId,
      status: job.status,
    }
  }

  async tombstone(request) {
    try {
      assertTombstoneRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    const results = []
    for (const ref of request.refs ?? []) {
      if (!sameScope(ref.scope, request.scope)) {
        results.push({
          ref,
          status: "rejected",
          error: {
            code: "scope_mismatch",
            message: "ref scope does not match request scope",
            retryable: false,
            details: {},
          },
        })
        continue
      }
      const existing = await this.episodeStore.getEpisodeByRef(ref)
      if (!existing) {
        results.push({ ref, status: "not_found" })
        continue
      }
      if (existing.status === "tombstoned") {
        results.push({ ref, status: "already_tombstoned" })
        continue
      }
      await this.episodeStore.tombstoneEpisode(ref, request.reason)
      await this.indexStore.removeOrHidePayload(ref)
      results.push({ ref, status: "tombstoned", affectedDerivedRefs: [] })
    }

    const tombstonedEvents = results
      .filter((result) => result.status === "tombstoned")
      .map((result) => createEvent(request.scope, "memory.tombstoned", { ref: result.ref, cascadePolicy: request.cascadePolicy }))
    await appendEvents(this.metadataStore, request.scope, tombstonedEvents)

    return { results }
  }

  async subscribe(request) {
    try {
      assertSubscribeRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    const cursor = request.cursor ?? randomId("cursor")
    await this.metadataStore.saveEventCursor(request.scope, cursor)

    const events = await this.metadataStore.getEventsSince(request.scope, request.cursor ?? null, request.eventTypes ?? null)

    return {
      scope: cloneScope(request.scope),
      cursor,
      eventTypes: request.eventTypes ?? [],
      events,
    }
  }

  async getJob(request) {
    try {
      assertGetJobRequest(request)
    } catch (error) {
      throw new MemoryApiRuntimeError("invalid_request", error.message, false)
    }

    const job = await this.metadataStore.getJob(request.scope, request.jobId)
    if (!job) {
      throw new MemoryApiRuntimeError("job_not_found", "job not found", false)
    }
    return job
  }
}
