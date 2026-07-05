import type { MemoryRef, Scope } from "./types"

export function scopeKey(scope: Scope): string {
  const agent = scope.agentId ?? "*"
  const session = scope.sessionId ?? "*"
  return `${scope.tenantId}::${scope.namespaceId}::${agent}::${session}`
}

export function strictScopeKey(scope: Scope): string {
  const agent = scope.agentId ?? ""
  const session = scope.sessionId ?? ""
  return `${scope.tenantId}::${scope.namespaceId}::${agent}::${session}`
}

export function refKey(ref: MemoryRef): string {
  return `${strictScopeKey(ref.scope)}::${ref.type}::${ref.id}`
}

export function sameTenantNamespace(a: Scope, b: Scope): boolean {
  return a.tenantId === b.tenantId && a.namespaceId === b.namespaceId
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function estimateTokens(input: unknown): number {
  const text = typeof input === "string" ? input : JSON.stringify(input)
  return Math.max(1, Math.ceil(text.length / 4))
}

export function containsQuery(content: unknown, query: string): boolean {
  const haystack = (typeof content === "string" ? content : JSON.stringify(content)).toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(token => haystack.includes(token))
}
