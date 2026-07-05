export const memoryObjectTypes = ["episode", "atom", "consolidation", "link"]

export const memoryLifecycleStatuses = [
  "active",
  "disputed",
  "superseded",
  "tombstoned",
  "pending",
  "failed",
]

export const linkTypes = [
  "derived_from",
  "supports",
  "contradicts",
  "supersedes",
  "mentions",
  "same_as",
  "corrects",
  "invalidates",
]

export function createMemoryRef(id, type, scope) {
  return { id, type, scope }
}

export function sameScope(left, right) {
  return (
    left?.tenantId === right?.tenantId &&
    left?.namespaceId === right?.namespaceId &&
    (left?.agentId ?? null) === (right?.agentId ?? null) &&
    (left?.sessionId ?? null) === (right?.sessionId ?? null)
  )
}

export function scopeKey(scope) {
  return [
    scope?.tenantId ?? "",
    scope?.namespaceId ?? "",
    scope?.agentId ?? "",
    scope?.sessionId ?? "",
  ].join(":")
}

export function cloneScope(scope) {
  return {
    tenantId: scope.tenantId,
    namespaceId: scope.namespaceId,
    ...(scope.agentId ? { agentId: scope.agentId } : {}),
    ...(scope.sessionId ? { sessionId: scope.sessionId } : {}),
  }
}
