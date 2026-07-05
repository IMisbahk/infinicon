import { errors } from "./errors"
import type {
  AssembleContextRequest,
  ConsolidateRequest,
  GetJobRequest,
  HydrateRequest,
  IngestRequest,
  QueryRequest,
  Scope,
  SubscribeRequest,
  TombstoneRequest,
} from "./types"

export const assertScope = (scope: Scope): void => {
  if (!scope.tenantId || !scope.namespaceId) throw errors.invalidScope()
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw errors.invalidRequest(message)
}

export function validateIngest(req: IngestRequest): void {
  assertScope(req.scope)
  assert(Array.isArray(req.episodes) && req.episodes.length > 0, "episodes must be a non-empty array")
  if (req.consistency) {
    assert(req.consistency === "accepted" || req.consistency === "indexed", "ingest consistency must be accepted or indexed")
  }
  for (const episode of req.episodes) {
    assert(typeof episode.contentType === "string" && episode.contentType.length > 0, "episode contentType is required")
    assert(episode.createdBy?.id && typeof episode.createdBy.id === "string", "episode createdBy.id is required")
  }
}

export function validateQuery(req: QueryRequest): void {
  assertScope(req.scope)
  assert(typeof req.query === "string", "query must be a string")
  if (req.consistency) {
    assert(req.consistency === "strong" || req.consistency === "eventual", "query consistency must be strong or eventual")
  }
  if (req.limit !== undefined) {
    assert(Number.isInteger(req.limit) && req.limit > 0, "query limit must be a positive integer")
  }
}

export function validateHydrate(req: HydrateRequest): void {
  assertScope(req.scope)
  assert(Array.isArray(req.refs), "refs must be an array")
}

export function validateAssembleContext(req: AssembleContextRequest): void {
  assertScope(req.scope)
  assert(typeof req.task === "string" && req.task.length > 0, "task is required")
  assert(Number.isFinite(req.budget.maxTokens) && req.budget.maxTokens >= 0, "budget.maxTokens must be >= 0")
  if (req.budget.maxSegments !== undefined) {
    assert(Number.isInteger(req.budget.maxSegments) && req.budget.maxSegments > 0, "budget.maxSegments must be a positive integer")
  }
  if (req.budget.reservedTokens !== undefined) {
    assert(Number.isFinite(req.budget.reservedTokens) && req.budget.reservedTokens >= 0, "budget.reservedTokens must be >= 0")
  }
  if (req.consistency) {
    assert(req.consistency === "strong" || req.consistency === "eventual", "assembleContext consistency must be strong or eventual")
  }
}

export function validateConsolidate(req: ConsolidateRequest): void {
  assertScope(req.scope)
  const validTriggers = new Set(["manual", "scheduled", "threshold", "idle"])
  assert(validTriggers.has(req.trigger), "consolidate trigger must be manual|scheduled|threshold|idle")
  if (req.mode) {
    assert(req.mode === "enqueue" || req.mode === "run_now", "consolidate mode must be enqueue or run_now")
  }
}

export function validateGetJob(req: GetJobRequest): void {
  assertScope(req.scope)
  assert(typeof req.jobId === "string" && req.jobId.length > 0, "jobId is required")
}

export function validateSubscribe(req: SubscribeRequest): void {
  assertScope(req.scope)
  if (req.cursor !== undefined) {
    assert(typeof req.cursor === "string", "cursor must be a string")
  }
}

export function validateTombstone(req: TombstoneRequest): void {
  assertScope(req.scope)
  assert(Array.isArray(req.refs) && req.refs.length > 0, "refs must be a non-empty array")
  assert(typeof req.reason === "string" && req.reason.length > 0, "reason is required")
  const policies = new Set(["none", "mark_derived_stale", "tombstone_derived"])
  assert(policies.has(req.cascadePolicy), "cascadePolicy must be none|mark_derived_stale|tombstone_derived")
}
