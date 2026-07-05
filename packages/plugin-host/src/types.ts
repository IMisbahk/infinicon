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

export type PluginRegistrationInput<TConfig = unknown, TInput = unknown, TOutput = unknown> = {
  plugin: InfiniconPlugin<TConfig, TInput, TOutput>
  config: TConfig
}

export type PluginRunRequest<TInput = unknown> = {
  kind: PluginKind
  name: string
  version: string
  input: TInput
  context: PluginContext
}

export type PluginHostEvent =
  | {
      type: "plugin_registered"
      pluginKey: string
      descriptor: PluginDescriptor
    }
  | {
      type: "plugin_unregistered"
      pluginKey: string
      descriptor: PluginDescriptor
    }
  | {
      type: "plugin_executed"
      pluginKey: string
      descriptor: PluginDescriptor
      requestId: string
    }

export type PluginHostStats = {
  totalRegisteredPlugins: number
  registeredByKind: Record<PluginKind, number>
}

export type PluginHostEventListener = (event: PluginHostEvent) => void

export type PluginHostSubscription = {
  unsubscribe: () => void
}

export type PluginHostOptions = {
  onEventListenerError?: (error: unknown, event: PluginHostEvent) => void
}

export type PluginHostReadonlyView = {
  specVersion: string
  listByKind(kind: PluginKind): readonly RegisteredPlugin[]
  get(kind: PluginKind, name: string, version: string): RegisteredPlugin | undefined
  has(kind: PluginKind, name: string, version: string): boolean
  stats(): PluginHostStats
}
