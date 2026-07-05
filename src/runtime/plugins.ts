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

export class SimpleKeywordExtractorPlugin implements ExtractorPlugin {
  descriptor: PluginDescriptor = {
    name: "simple-keyword-extractor",
    version: "0.1.0",
    kind: "extractor",
    supportedSpecVersion: "v0",
    configSchema: {},
    capabilities: ["keyword-atoms"],
    sideEffects: [],
    idempotencyGuarantees: ["deterministic keyword extraction"],
  }

  async extract(input: {
    sourceRefs: MemoryRef[]
    sourceContent: DurableMemoryObject[]
    scope: Scope
    policy?: Record<string, unknown>
  }): Promise<{
    atoms: Array<{ atomType: string; content: string; confidence?: number; metadata?: Record<string, unknown> }>
    links: []
    warnings: string[]
  }> {
    const atoms: Array<{ atomType: string; content: string; confidence?: number; metadata?: Record<string, unknown> }> = []
    const warnings: string[] = []

    for (const source of input.sourceContent) {
      if (source.type !== "episode") continue
      const text = typeof source.content === "string" ? source.content : JSON.stringify(source.content)
      const words = [...new Set(text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [])]
      if (words.length === 0) warnings.push(`no keywords in episode ${source.id}`)
      for (const word of words.slice(0, 24)) {
        atoms.push({ atomType: "keyword", content: word, confidence: 0.75, metadata: { sourceId: source.id } })
      }
    }

    return { atoms, links: [], warnings }
  }
}

export class SimpleConsolidatorPlugin implements ConsolidatorPlugin {
  descriptor: PluginDescriptor = {
    name: "simple-consolidator",
    version: "0.1.0",
    kind: "consolidator",
    supportedSpecVersion: "v0",
    configSchema: {},
    capabilities: ["text-merge"],
    sideEffects: ["writes_runtime_state"],
    idempotencyGuarantees: ["deterministic merge order"],
  }

  async consolidate(input: {
    scope: Scope
    sourceRefs: MemoryRef[]
    sourceContent: DurableMemoryObject[]
    policy?: Record<string, unknown>
  }): Promise<{
    consolidations: Array<{ title?: string; content: string; metadata?: Record<string, unknown>; supersedes?: MemoryRef[]; confidence?: number }>
    links: Link[]
    warnings: string[]
  }> {
    const chunks = input.sourceContent
      .filter((object) => object.type === "episode" || object.type === "atom" || object.type === "consolidation")
      .map((object) => (typeof object.content === "string" ? object.content : JSON.stringify(object.content)))

    if (chunks.length === 0) {
      return { consolidations: [], links: [], warnings: ["no consolidatable sources"] }
    }

    const episodeRefs = input.sourceContent
      .filter((object) => object.type === "episode")
      .map((object) => ({ id: object.id, type: object.type as "episode", scope: object.scope }))

    return {
      consolidations: [
        {
          title: "merged memory",
          content: chunks.join("\n"),
          confidence: 0.65,
          metadata: { sourceCount: chunks.length },
          supersedes: episodeRefs.length > 0 ? episodeRefs : undefined,
        },
      ],
      links: [],
      warnings: [],
    }
  }
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

export class SimpleRankerPlugin implements RankerPlugin {
  descriptor: PluginDescriptor = {
    name: "simple-ranker",
    version: "0.1.0",
    kind: "ranker",
    supportedSpecVersion: "v0",
    configSchema: {},
    capabilities: ["lexical-rescore"],
    sideEffects: [],
    idempotencyGuarantees: ["deterministic query token overlap"],
  }

  async rank(input: {
    query: string
    candidates: Array<{ ref: MemoryRef; excerpt?: string }>
    scope: Scope
  }): Promise<Array<{ ref: MemoryRef; score: number; reason?: string }>> {
    const queryTokens = new Set(input.query.toLowerCase().split(/\s+/).filter(Boolean))

    return input.candidates
      .map((candidate) => {
        const haystack = (candidate.excerpt ?? "").toLowerCase()
        let overlap = 0
        for (const token of queryTokens) {
          if (haystack.includes(token)) overlap += 1
        }
        const score = overlap / Math.max(queryTokens.size, 1)
        return {
          ref: candidate.ref,
          score,
          reason: overlap > 0 ? "ranker lexical overlap" : "ranker no overlap",
        }
      })
      .sort((a, b) => b.score - a.score)
  }
}
