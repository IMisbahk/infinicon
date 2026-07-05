export const pluginSpecVersionV0 = "v0"

export type PluginSpecVersion = typeof pluginSpecVersionV0 | string

export type PluginKind =
  | "extractor"
  | "embedder"
  | "ranker"
  | "consolidator"
  | "formatter"
  | "storage_adapter"

export type PluginSideEffectLevel = "none" | "read_only" | "writes_runtime_state" | "writes_external_state"

export type PluginValidationIssue = {
  field: string
  message: string
}

export type PluginConfigValidationResult = {
  ok: true
} | {
  ok: false
  issues: PluginValidationIssue[]
}

export type PluginDescriptor = {
  name: string
  version: string
  kind: PluginKind
  supportedSpecVersion: PluginSpecVersion
  configSchema: Record<string, unknown>
  capabilities: string[]
  sideEffects: PluginSideEffectLevel
  idempotencyGuarantees: string
}

export type PluginContext = {
  scope: {
    tenantId: string
    namespaceId: string
    agentId?: string
    sessionId?: string
  }
  requestId: string
}

export interface InfiniconPlugin<TConfig, TInput, TOutput> {
  descriptor: PluginDescriptor
  validateConfig(config: unknown): PluginConfigValidationResult
  run(input: TInput, context: PluginContext, config: TConfig): Promise<TOutput>
}

export type RegisteredPlugin<TConfig = unknown, TInput = unknown, TOutput = unknown> = {
  descriptor: PluginDescriptor
  config: TConfig
  plugin: InfiniconPlugin<TConfig, TInput, TOutput>
}
