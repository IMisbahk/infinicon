export type AgentConfig = {
  infiniconBaseUrl: string
  infiniconApiKey?: string
  tenantId: string
  namespaceId: string
  agentId: string
  sessionId?: string
  openAiApiKey?: string
  openAiModel: string
  openAiBaseUrl: string
  contextMaxTokens: number
  consolidateEveryTurns: number
}

const required = (name: string, value: string | undefined): string => {
  if (!value?.trim()) throw new Error(`missing required env var: ${name}`)
  return value.trim()
}

const optional = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const loadConfig = (): AgentConfig => {
  const tenantId = required("INFINICON_TENANT_ID", process.env.INFINICON_TENANT_ID)
  const namespaceId = required("INFINICON_NAMESPACE_ID", process.env.INFINICON_NAMESPACE_ID)
  const agentId = required("INFINICON_AGENT_ID", process.env.INFINICON_AGENT_ID)

  return {
    infiniconBaseUrl: required("INFINICON_BASE_URL", process.env.INFINICON_BASE_URL ?? "http://localhost:8787"),
    infiniconApiKey: optional(process.env.INFINICON_API_KEY),
    tenantId,
    namespaceId,
    agentId,
    sessionId: optional(process.env.INFINICON_SESSION_ID),
    openAiApiKey: optional(process.env.OPENAI_API_KEY),
    openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    openAiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    contextMaxTokens: Number(process.env.CONTEXT_MAX_TOKENS ?? 2048),
    consolidateEveryTurns: Number(process.env.CONSOLIDATE_EVERY_TURNS ?? 8),
  }
}
