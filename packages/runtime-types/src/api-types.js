import { contextWarningCodes, createWarning } from "./warnings.js"

export const ingestConsistencyModes = ["accepted", "indexed"]
export const readConsistencyModes = ["strong", "eventual"]

export function createApiError(code, message, retryable = false, details = {}) {
  return { code, message, retryable, details }
}

export function assertScope(scope) {
  if (!scope || typeof scope !== "object") {
    throw new Error("scope must be an object")
  }
  if (!scope.tenantId || !scope.namespaceId) {
    throw new Error("scope.tenantId and scope.namespaceId are required")
  }
}

function assertMemoryRef(ref, fieldName = "ref") {
  if (!ref || typeof ref !== "object") {
    throw new Error(`${fieldName} must be an object`)
  }
  if (typeof ref.id !== "string" || ref.id.length === 0) {
    throw new Error(`${fieldName}.id must be a non-empty string`)
  }
  if (typeof ref.type !== "string" || ref.type.length === 0) {
    throw new Error(`${fieldName}.type must be a non-empty string`)
  }
  assertScope(ref.scope)
}

export function assertIngestRequest(request) {
  assertScope(request?.scope)
  if (!Array.isArray(request?.episodes) || request.episodes.length === 0) {
    throw new Error("ingest request must include at least one episode")
  }
  for (const [index, episode] of request.episodes.entries()) {
    if (!episode || typeof episode !== "object") {
      throw new Error(`episodes[${index}] must be an object`)
    }
    if (typeof episode.contentType !== "string" || episode.contentType.length === 0) {
      throw new Error(`episodes[${index}].contentType must be a non-empty string`)
    }
    if (!("content" in episode)) {
      throw new Error(`episodes[${index}].content is required`)
    }
  }
}

export function assertQueryRequest(request) {
  assertScope(request?.scope)
  if (typeof request?.query !== "string") {
    throw new Error("query request must include query string")
  }
  if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit <= 0)) {
    throw new Error("query request limit must be a positive integer when provided")
  }
}

export function assertHydrateRequest(request) {
  assertScope(request?.scope)
  if (!Array.isArray(request?.refs)) {
    throw new Error("hydrate request must include refs array")
  }
  for (const [index, ref] of request.refs.entries()) {
    assertMemoryRef(ref, `refs[${index}]`)
  }
}

export function assertAssembleContextRequest(request) {
  assertScope(request?.scope)
  if (typeof request?.task !== "string") {
    throw new Error("assembleContext request must include task string")
  }
  if (!request?.budget || typeof request.budget !== "object") {
    throw new Error("assembleContext request must include budget")
  }
  if (request.budget.maxTokens !== undefined && (!Number.isInteger(request.budget.maxTokens) || request.budget.maxTokens < 0)) {
    throw new Error("budget.maxTokens must be a non-negative integer when provided")
  }
  if (request.budget.maxSegments !== undefined && (!Number.isInteger(request.budget.maxSegments) || request.budget.maxSegments < 0)) {
    throw new Error("budget.maxSegments must be a non-negative integer when provided")
  }
}

export function assertConsolidateRequest(request) {
  assertScope(request?.scope)
  if (typeof request?.trigger !== "string" || request.trigger.length === 0) {
    throw new Error("consolidate request must include trigger")
  }
  const allowedTriggers = ["manual", "scheduled", "threshold", "idle"]
  if (!allowedTriggers.includes(request.trigger)) {
    throw new Error("consolidate request trigger is invalid")
  }
  if (request.mode !== undefined) {
    const allowedModes = ["enqueue", "run_now"]
    if (!allowedModes.includes(request.mode)) {
      throw new Error("consolidate request mode is invalid")
    }
  }
}

export function assertTombstoneRequest(request) {
  assertScope(request?.scope)
  if (!Array.isArray(request?.refs) || request.refs.length === 0) {
    throw new Error("tombstone request must include refs")
  }
  if (typeof request?.reason !== "string" || request.reason.length === 0) {
    throw new Error("tombstone request must include reason")
  }
  for (const [index, ref] of request.refs.entries()) {
    assertMemoryRef(ref, `refs[${index}]`)
  }
}

export function assertSubscribeRequest(request) {
  assertScope(request?.scope)
  if (request?.eventTypes !== undefined && !Array.isArray(request.eventTypes)) {
    throw new Error("subscribe request eventTypes must be an array when provided")
  }
}

export function assertGetJobRequest(request) {
  assertScope(request?.scope)
  if (typeof request?.jobId !== "string" || request.jobId.length === 0) {
    throw new Error("getJob request must include jobId")
  }
}

export function normalizeWarning(code, message, details = {}) {
  if (!contextWarningCodes.includes(code)) {
    return createWarning("eventual_consistency", "unknown warning code normalized", {
      originalCode: code,
      originalMessage: message,
      originalDetails: details,
    })
  }
  return createWarning(code, message, details)
}
