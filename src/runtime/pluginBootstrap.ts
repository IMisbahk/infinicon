import { PluginHost, pluginSpecVersionV0, type InfiniconPlugin, type PluginContext } from "@infinicon/plugin-host"

import type { MemoryRuntimeDependencies } from "./service"
import type { RuntimeMetricsHook } from "./observability"
import {
  SimpleConsolidatorPlugin,
  SimpleEmbedderPlugin,
  SimpleKeywordExtractorPlugin,
  SimpleRankerPlugin,
  type ConsolidatorPlugin,
  type EmbedderPlugin,
  type ExtractorPlugin,
  type RankerPlugin,
} from "./plugins"

type EmptyConfig = Record<string, never>

const okConfig = (): { ok: true } => ({ ok: true })

const toHostSideEffects = (levels: string[]): "none" | "read_only" | "writes_runtime_state" | "writes_external_state" => {
  if (levels.includes("writes_external_state")) return "writes_external_state"
  if (levels.includes("writes_runtime_state")) return "writes_runtime_state"
  if (levels.includes("read_only")) return "read_only"
  return "none"
}

const wrapExtractor = (plugin: ExtractorPlugin): InfiniconPlugin<EmptyConfig, Parameters<ExtractorPlugin["extract"]>[0], Awaited<ReturnType<ExtractorPlugin["extract"]>>> => ({
  descriptor: {
    name: plugin.descriptor.name,
    version: plugin.descriptor.version,
    kind: "extractor",
    supportedSpecVersion: plugin.descriptor.supportedSpecVersion,
    configSchema: plugin.descriptor.configSchema,
    capabilities: plugin.descriptor.capabilities,
    sideEffects: toHostSideEffects(plugin.descriptor.sideEffects),
    idempotencyGuarantees: plugin.descriptor.idempotencyGuarantees.join("; "),
  },
  validateConfig: () => okConfig(),
  run: (input) => plugin.extract(input),
})

const wrapEmbedder = (plugin: EmbedderPlugin): InfiniconPlugin<EmptyConfig, Parameters<EmbedderPlugin["embed"]>[0], Awaited<ReturnType<EmbedderPlugin["embed"]>>> => ({
  descriptor: {
    name: plugin.descriptor.name,
    version: plugin.descriptor.version,
    kind: "embedder",
    supportedSpecVersion: plugin.descriptor.supportedSpecVersion,
    configSchema: plugin.descriptor.configSchema,
    capabilities: plugin.descriptor.capabilities,
    sideEffects: toHostSideEffects(plugin.descriptor.sideEffects),
    idempotencyGuarantees: plugin.descriptor.idempotencyGuarantees.join("; "),
  },
  validateConfig: () => okConfig(),
  run: (input) => plugin.embed(input),
})

const wrapRanker = (plugin: RankerPlugin): InfiniconPlugin<EmptyConfig, Parameters<RankerPlugin["rank"]>[0], Awaited<ReturnType<RankerPlugin["rank"]>>> => ({
  descriptor: {
    name: plugin.descriptor.name,
    version: plugin.descriptor.version,
    kind: "ranker",
    supportedSpecVersion: plugin.descriptor.supportedSpecVersion,
    configSchema: plugin.descriptor.configSchema,
    capabilities: plugin.descriptor.capabilities,
    sideEffects: toHostSideEffects(plugin.descriptor.sideEffects),
    idempotencyGuarantees: plugin.descriptor.idempotencyGuarantees.join("; "),
  },
  validateConfig: () => okConfig(),
  run: (input) => plugin.rank(input),
})

const wrapConsolidator = (plugin: ConsolidatorPlugin): InfiniconPlugin<EmptyConfig, Parameters<ConsolidatorPlugin["consolidate"]>[0], Awaited<ReturnType<ConsolidatorPlugin["consolidate"]>>> => ({
  descriptor: {
    name: plugin.descriptor.name,
    version: plugin.descriptor.version,
    kind: "consolidator",
    supportedSpecVersion: plugin.descriptor.supportedSpecVersion,
    configSchema: plugin.descriptor.configSchema,
    capabilities: plugin.descriptor.capabilities,
    sideEffects: toHostSideEffects(plugin.descriptor.sideEffects),
    idempotencyGuarantees: plugin.descriptor.idempotencyGuarantees.join("; "),
  },
  validateConfig: () => okConfig(),
  run: (input) => plugin.consolidate(input),
})

export type BootstrappedRuntime = {
  host: PluginHost
  plugins: {
    extractor: ExtractorPlugin
    embedder: EmbedderPlugin
    ranker: RankerPlugin
    consolidator?: ConsolidatorPlugin
  }
}

export const createDefaultPluginHost = (): BootstrappedRuntime => {
  const extractor = new SimpleKeywordExtractorPlugin()
  const embedder = new SimpleEmbedderPlugin()
  const ranker = new SimpleRankerPlugin()
  const consolidator = new SimpleConsolidatorPlugin()

  const host = new PluginHost(pluginSpecVersionV0)
  host.registerMany([
    { plugin: wrapExtractor(extractor), config: {} },
    { plugin: wrapEmbedder(embedder), config: {} },
    { plugin: wrapRanker(ranker), config: {} },
    { plugin: wrapConsolidator(consolidator), config: {} },
  ])

  return {
    host,
    plugins: { extractor, embedder, ranker, consolidator },
  }
}

export const createRuntimeDeps = (
  stores: Omit<MemoryRuntimeDependencies, "extractor" | "embedder" | "ranker" | "consolidator" | "metricsHook">,
  bootstrap: BootstrappedRuntime = createDefaultPluginHost(),
  metricsHook?: RuntimeMetricsHook,
): MemoryRuntimeDependencies => ({
  ...stores,
  extractor: bootstrap.plugins.extractor,
  embedder: bootstrap.plugins.embedder,
  ranker: bootstrap.plugins.ranker,
  consolidator: bootstrap.plugins.consolidator,
  metricsHook,
})

export const pluginContextFromScope = (scope: PluginContext["scope"], requestId: string): PluginContext => ({
  scope,
  requestId,
})
