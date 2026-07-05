import { InfiniconClient, type InfiniconClientConfig } from "./client"
import { ScopedMemory } from "./scopedMemory"
import type { Scope } from "./types"

export const scopeFromEnv = (overrides: Partial<Scope> = {}): Scope => ({
  tenantId: process.env.INFINICON_TENANT_ID?.trim() || "default",
  namespaceId: process.env.INFINICON_NAMESPACE_ID?.trim() || "default",
  ...(process.env.INFINICON_AGENT_ID?.trim() ? { agentId: process.env.INFINICON_AGENT_ID.trim() } : {}),
  ...(process.env.INFINICON_SESSION_ID?.trim() ? { sessionId: process.env.INFINICON_SESSION_ID.trim() } : {}),
  ...overrides,
})

export const createClient = (config: Partial<InfiniconClientConfig> = {}): InfiniconClient => {
  const apiKey = config.apiKey ?? process.env.INFINICON_API_KEY?.trim()
  return new InfiniconClient({
    baseUrl: config.baseUrl ?? process.env.INFINICON_BASE_URL?.trim() ?? "http://localhost:8787",
    ...(apiKey ? { apiKey } : {}),
    ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    ...(config.headers ? { headers: config.headers } : {}),
  })
}

export const withScope = (client: InfiniconClient, scope: Scope): ScopedMemory =>
  new ScopedMemory(client, scope)

export const openMemory = (scope?: Scope, client?: InfiniconClient): ScopedMemory =>
  withScope(client ?? createClient(), scope ?? scopeFromEnv())
