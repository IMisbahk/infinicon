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

export function assertIngestRequest(request) {
  assertScope(request?.scope)
  if (!Array.isArray(request?.episodes) || request.episodes.length === 0) {
    throw new Error("ingest request must include at least one episode")
  }
}

export function assertQueryRequest(request) {
  assertScope(request?.scope)
  if (typeof request?.query !== "string") {
    throw new Error("query request must include query string")
  }
}

export function assertHydrateRequest(request) {
  assertScope(request?.scope)
  if (!Array.isArray(request?.refs)) {
    throw new Error("hydrate request must include refs array")
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
