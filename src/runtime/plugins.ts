import type { DurableMemoryObject, Link, MemoryRef, Scope } from "./types"

export type PluginDescriptor = {
  name: string
  version: string
  kind: "extractor" | "embedder" | "ranker" | "consolidator" | "formatter" | "storage-adapter"
  supportedSpecVersion: string
  configSchema: Record<string, unknown>
  capabilities: string[]
  sideEffects: string[]
  idempotencyGuarantees: string[]
}

export interface ExtractorPlugin {
  descriptor: PluginDescriptor
  extract(input: {
    sourceRefs: MemoryRef[]
    sourceContent: DurableMemoryObject[]
    scope: Scope
    policy?: Record<string, unknown>
  }): Promise<{
    atoms: Array<{
      atomType: string
      content: string
      confidence?: number
      metadata?: Record<string, unknown>
    }>
    links: Array<{ linkType: string; from: MemoryRef; to: MemoryRef; metadata?: Record<string, unknown> }>
    warnings: string[]
  }>
}

export interface EmbedderPlugin {
  descriptor: PluginDescriptor
  embed(input: {
    ref: MemoryRef
    text: string
    metadata?: Record<string, unknown>
  }): Promise<{
    payloadText: string
    algorithm: string
    stats?: Record<string, number>
  }>
}

export interface RankerPlugin {
  descriptor: PluginDescriptor
  rank(input: {
    query: string
    candidates: Array<{ ref: MemoryRef; excerpt?: string }>
    scope: Scope
  }): Promise<Array<{ ref: MemoryRef; score: number; reason?: string }>>
}

export interface ConsolidatorPlugin {
  descriptor: PluginDescriptor
  consolidate(input: {
    scope: Scope
    sourceRefs: MemoryRef[]
    sourceContent: DurableMemoryObject[]
    policy?: Record<string, unknown>
  }): Promise<{
    consolidations: Array<{
      title?: string
      content: string
      metadata?: Record<string, unknown>
      supersedes?: MemoryRef[]
      confidence?: number
    }>
    links: Link[]
    warnings: string[]
  }>
}

export interface FormatterPlugin {
  descriptor: PluginDescriptor
  format(input: {
    target: string
    workingContext: unknown
    preferences?: Record<string, unknown>
  }): Promise<{ output: unknown }>
}

export class NoopExtractorPlugin implements ExtractorPlugin {
  descriptor: PluginDescriptor = {
    name: "noop-extractor",
    version: "0.1.0",
    kind: "extractor",
    supportedSpecVersion: "v0",
    configSchema: {},
    capabilities: [],
    sideEffects: [],
    idempotencyGuarantees: ["same input returns no-op output"],
  }

  async extract(): Promise<{ atoms: []; links: []; warnings: string[] }> {
    return { atoms: [], links: [], warnings: [] }
  }
}

export class SimpleEmbedderPlugin implements EmbedderPlugin {
  descriptor: PluginDescriptor = {
    name: "simple-embedder",
    version: "0.1.0",
    kind: "embedder",
    supportedSpecVersion: "v0",
    configSchema: {},
    capabilities: ["lexical-normalization"],
    sideEffects: [],
    idempotencyGuarantees: ["deterministic normalization"],
  }

  async embed(input: { ref: MemoryRef; text: string; metadata?: Record<string, unknown> }): Promise<{ payloadText: string; algorithm: string; stats?: Record<string, number> }> {
    const normalized = input.text.toLowerCase().replace(/\s+/g, " ").trim()
    return {
      payloadText: normalized,
      algorithm: "simple-lowercase-lexical",
      stats: { length: normalized.length },
    }
  }
}
