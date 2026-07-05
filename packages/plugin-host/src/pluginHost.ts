import { PluginHostError } from "./errors"
import {
  pluginSpecVersionV0,
  type PluginConfigValidationResult,
  type PluginContext,
  type PluginDescriptor,
  type PluginHostEvent,
  type PluginHostEventListener,
  type PluginHostReadonlyView,
  type PluginHostStats,
  type PluginHostSubscription,
  type PluginKind,
  type PluginRegistrationInput,
  type PluginRunRequest,
  type RegisteredPlugin,
} from "./types"

type PluginKey = string

const buildPluginKey = (descriptor: PluginDescriptor): PluginKey =>
  `${descriptor.kind}::${descriptor.name}::${descriptor.version}`

const validateDescriptor = (descriptor: PluginDescriptor): PluginConfigValidationResult => {
  const issues: { field: string; message: string }[] = []

  if (!descriptor.name.trim()) issues.push({ field: "name", message: "name must be non-empty" })
  if (!descriptor.version.trim()) issues.push({ field: "version", message: "version must be non-empty" })
  if (!descriptor.supportedSpecVersion.trim()) {
    issues.push({ field: "supportedSpecVersion", message: "supportedSpecVersion must be non-empty" })
  }
  if (!Array.isArray(descriptor.capabilities)) {
    issues.push({ field: "capabilities", message: "capabilities must be an array" })
  } else if (descriptor.capabilities.some((capability) => typeof capability !== "string" || !capability.trim())) {
    issues.push({ field: "capabilities", message: "capabilities must contain only non-empty strings" })
  }
  if (!descriptor.idempotencyGuarantees.trim()) {
    issues.push({ field: "idempotencyGuarantees", message: "idempotencyGuarantees must be non-empty" })
  }
  if (!descriptor.configSchema || typeof descriptor.configSchema !== "object") {
    issues.push({ field: "configSchema", message: "configSchema must be an object" })
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true }
}

export class PluginHost implements PluginHostReadonlyView {
  readonly specVersion: string
  private readonly pluginsByKey = new Map<PluginKey, RegisteredPlugin>()
  private readonly pluginsByKind = new Map<PluginKind, RegisteredPlugin[]>()
  private readonly listeners = new Set<PluginHostEventListener>()

  constructor(specVersion: string = pluginSpecVersionV0) {
    this.specVersion = specVersion
  }

  register<TConfig, TInput, TOutput>({ plugin, config }: PluginRegistrationInput<TConfig, TInput, TOutput>): void {
    const descriptorValidation = validateDescriptor(plugin.descriptor)
    if (!descriptorValidation.ok) {
      throw new PluginHostError("plugin_descriptor_invalid", "plugin descriptor is invalid", {
        descriptor: plugin.descriptor,
        issues: descriptorValidation.issues,
      })
    }

    if (plugin.descriptor.supportedSpecVersion !== this.specVersion) {
      throw new PluginHostError(
        "plugin_spec_version_mismatch",
        `plugin ${plugin.descriptor.name} does not support host spec version ${this.specVersion}`,
        {
          pluginSupportedSpecVersion: plugin.descriptor.supportedSpecVersion,
          hostSpecVersion: this.specVersion,
        },
      )
    }

    const pluginKey = buildPluginKey(plugin.descriptor)
    if (this.pluginsByKey.has(pluginKey)) {
      throw new PluginHostError("plugin_already_registered", `plugin ${pluginKey} is already registered`, {
        pluginKey,
      })
    }

    const validation = plugin.validateConfig(config)
    if (!validation.ok) {
      throw new PluginHostError("plugin_config_invalid", `plugin ${plugin.descriptor.name} config is invalid`, {
        issues: validation.issues,
      })
    }

    const registration: RegisteredPlugin<TConfig, TInput, TOutput> = {
      descriptor: Object.freeze({
        ...plugin.descriptor,
        capabilities: [...plugin.descriptor.capabilities],
      }),
      config,
      plugin,
    }

    this.pluginsByKey.set(pluginKey, registration)
    const byKind = this.pluginsByKind.get(plugin.descriptor.kind) ?? []
    byKind.push(registration)
    this.pluginsByKind.set(plugin.descriptor.kind, byKind)
    this.emit({
      type: "plugin_registered",
      pluginKey,
      descriptor: registration.descriptor,
    })
  }

  unregister(kind: PluginKind, name: string, version: string): boolean {
    const pluginKey = `${kind}::${name}::${version}`
    const registration = this.pluginsByKey.get(pluginKey)
    if (!registration) return false

    this.pluginsByKey.delete(pluginKey)
    const byKind = this.pluginsByKind.get(kind) ?? []
    this.pluginsByKind.set(
      kind,
      byKind.filter((candidate) => {
        const key = `${candidate.descriptor.kind}::${candidate.descriptor.name}::${candidate.descriptor.version}`
        return key !== pluginKey
      }),
    )
    this.emit({
      type: "plugin_unregistered",
      pluginKey,
      descriptor: registration.descriptor,
    })

    return true
  }

  listByKind(kind: PluginKind): readonly RegisteredPlugin[] {
    const plugins = this.pluginsByKind.get(kind)
    if (!plugins) return []
    return [...plugins]
  }

  get(kind: PluginKind, name: string, version: string): RegisteredPlugin | undefined {
    return this.pluginsByKey.get(`${kind}::${name}::${version}`)
  }

  has(kind: PluginKind, name: string, version: string): boolean {
    return this.pluginsByKey.has(`${kind}::${name}::${version}`)
  }

  stats(): PluginHostStats {
    return {
      totalRegisteredPlugins: this.pluginsByKey.size,
      registeredByKind: {
        extractor: this.listByKind("extractor").length,
        embedder: this.listByKind("embedder").length,
        ranker: this.listByKind("ranker").length,
        consolidator: this.listByKind("consolidator").length,
        formatter: this.listByKind("formatter").length,
        storage_adapter: this.listByKind("storage_adapter").length,
      },
    }
  }

  subscribe(listener: PluginHostEventListener): PluginHostSubscription {
    this.listeners.add(listener)
    return {
      unsubscribe: () => {
        this.listeners.delete(listener)
      },
    }
  }

  asReadonly(): PluginHostReadonlyView {
    return {
      specVersion: this.specVersion,
      listByKind: (kind) => this.listByKind(kind),
      get: (kind, name, version) => this.get(kind, name, version),
      has: (kind, name, version) => this.has(kind, name, version),
      stats: () => this.stats(),
    }
  }

  async run<TInput, TOutput>(kind: PluginKind, name: string, version: string, input: TInput, context: PluginContext): Promise<TOutput> {
    const result = await this.runRequest<TInput, TOutput>({ kind, name, version, input, context })
    return result
  }

  async runRequest<TInput, TOutput>(request: PluginRunRequest<TInput>): Promise<TOutput> {
    const { kind, name, version, input, context } = request
    const pluginKey = `${kind}::${name}::${version}`
    const registered = this.get(kind, name, version)
    if (!registered) {
      throw new PluginHostError("plugin_not_found", `plugin ${kind}::${name}::${version} is not registered`, {
        kind,
        name,
        version,
      })
    }

    const output = await (registered.plugin.run(input, context, registered.config) as Promise<TOutput>)
    this.emit({
      type: "plugin_executed",
      pluginKey,
      descriptor: registered.descriptor,
      requestId: context.requestId,
    })

    return output
  }

  private emit(event: PluginHostEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}
