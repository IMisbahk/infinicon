import {
  validateAssembleContextRequest,
  validateIngestRequest,
  validateQueryRequest,
  validateTombstoneRequest,
} from "@infinicon/core-types"
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

const throwOnValidation = (result: { ok: boolean; issues: { path: string; message: string }[] }): void => {
  if (result.ok) return
  const first = result.issues[0]
  throw errors.invalidRequest(first ? `${first.path}: ${first.message}` : "invalid request")
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw errors.invalidRequest(message)
}

export function validateIngest(req: IngestRequest): void {
  assertScope(req.scope)
  throwOnValidation(validateIngestRequest(req))
}

export function validateQuery(req: QueryRequest): void {
  assertScope(req.scope)
  throwOnValidation(validateQueryRequest(req))
}

export function validateHydrate(req: HydrateRequest): void {
  assertScope(req.scope)
  assert(Array.isArray(req.refs), "refs must be an array")
}

export function validateAssembleContext(req: AssembleContextRequest): void {
  assertScope(req.scope)
  throwOnValidation(validateAssembleContextRequest(req))
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
  throwOnValidation(validateTombstoneRequest(req))
}
