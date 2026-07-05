import type { Scope } from "./types"

export function scopeKey(scope: Scope): string {
  return [scope.tenantId, scope.namespaceId, scope.agentId ?? "_", scope.sessionId ?? "_"].join("::")
}

export function sameScope(a: Scope, b: Scope): boolean {
  return scopeKey(a) === scopeKey(b)
}

export function ensureScope(scope: Scope): void {
  if (!scope.tenantId || !scope.namespaceId) {
    throw new Error("scope must include tenantId and namespaceId")
  }
}
