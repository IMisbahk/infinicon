import { InfiniconClient, type InfiniconClientConfig } from "./client"
import { ScopedMemory } from "./scopedMemory"
import type { Scope } from "./types"

type EnvBag = Record<string, string | undefined>

const readEnv = (): EnvBag =>
  (globalThis as { process?: { env?: EnvBag } }).process?.env ?? {}

const envString = (key: string): string | undefined => {
  const value = readEnv()[key]?.trim()
  return value || undefined
}

export const scopeFromEnv = (overrides: Partial<Scope> = {}): Scope => ({
  tenantId: envString("INFINICON_TENANT_ID") ?? "default",
  namespaceId: envString("INFINICON_NAMESPACE_ID") ?? "default",
  ...(envString("INFINICON_AGENT_ID") ? { agentId: envString("INFINICON_AGENT_ID")! } : {}),
  ...(envString("INFINICON_SESSION_ID") ? { sessionId: envString("INFINICON_SESSION_ID")! } : {}),
  ...overrides,
})

export const createClient = (config: Partial<InfiniconClientConfig> = {}): InfiniconClient => {
  const apiKey = config.apiKey ?? envString("INFINICON_API_KEY")
  return new InfiniconClient({
    baseUrl: config.baseUrl ?? envString("INFINICON_BASE_URL") ?? "http://localhost:8787",
    ...(apiKey ? { apiKey } : {}),
    ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
    ...(config.headers ? { headers: config.headers } : {}),
  })
}

export const withScope = (client: InfiniconClient, scope: Scope): ScopedMemory =>
  new ScopedMemory(client, scope)

export const openMemory = (scope?: Scope, client?: InfiniconClient): ScopedMemory =>
  withScope(client ?? createClient(), scope ?? scopeFromEnv())
