import crypto from "node:crypto"

import type { MemoryRef, Scope } from "./types"

export const nowIso = (): string => new Date().toISOString()

export const randomId = (prefix: string): string => {
  const random = crypto.randomBytes(8).toString("hex")
  return `${prefix}_${random}`
}

export const scopeKey = (scope: Scope): string => {
  const agent = scope.agentId ?? "*"
  const session = scope.sessionId ?? "*"
  return `${scope.tenantId}::${scope.namespaceId}::${agent}::${session}`
}

export const matchesScope = (objectScope: Scope, scope: Scope): boolean => {
  if (objectScope.tenantId !== scope.tenantId) return false
  if (objectScope.namespaceId !== scope.namespaceId) return false
  if (scope.agentId && objectScope.agentId !== scope.agentId) return false
  if (scope.sessionId && objectScope.sessionId !== scope.sessionId) return false
  return true
}

export const refKey = (ref: MemoryRef): string => `${ref.type}:${ref.id}`

export const estimateTokens = (value: unknown): number => {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return Math.ceil(Math.max(1, text.length) / 4)
}
