import type {
  ActorRef,
  ContextWarning,
  DurableMemoryObject,
  MemoryFilters,
  MemoryRef,
  Scope,
  WorkingContext,
} from "./model"

export type PluginKind =
  | "extractor"
  | "embedder"
  | "ranker"
  | "consolidator"
  | "formatter"
  | "storage_adapter"

export type PluginDescriptor = {
  name: string
  version: string
  kind: PluginKind
  supportedSpecVersion: string
  configSchema: Record<string, unknown>
  capabilities: Record<string, unknown>
  sideEffects: string[]
  idempotencyGuarantees: string[]
}

export type ExtractorInput = {
  scope: Scope
  sourceRefs: MemoryRef[]
  sourceObjects: DurableMemoryObject[]
  policy?: Record<string, unknown>
}

export type ExtractorOutput = {
  proposedAtoms: {
    atomType: string
    content: string
    confidence?: number
    metadata?: Record<string, unknown>
    provenance: {
      sourceRefs: MemoryRef[]
      producedBy: ActorRef
      transformation: string
    }
  }[]
  proposedLinks: {
    linkType: string
    from: MemoryRef
    to: MemoryRef
    metadata?: Record<string, unknown>
  }[]
  warnings?: ContextWarning[]
}

export interface ExtractorPlugin {
  descriptor: PluginDescriptor
  extract(input: ExtractorInput): Promise<ExtractorOutput>
}

export type EmbedderInput = {
  scope: Scope
  ref: MemoryRef
  content: string | Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type EmbedderOutput = {
  vector?: number[]
  payload?: Record<string, unknown>
  modelId: string
  deterministic: boolean
  dimensions?: number
  stats?: {
    inputTokens?: number
  }
}

export interface EmbedderPlugin {
  descriptor: PluginDescriptor
  embed(input: EmbedderInput): Promise<EmbedderOutput>
}

export type RankerInput = {
  scope: Scope
  queryOrTask: string
  candidates: MemoryRef[]
  excerpts?: Array<{
    ref: MemoryRef
    content: unknown
  }>
  filters?: MemoryFilters
}

export type RankerOutput = {
  results: Array<{
    ref: MemoryRef
    score: number
    reason?: string
    warnings?: ContextWarning[]
  }>
}

export interface RankerPlugin {
  descriptor: PluginDescriptor
  rank(input: RankerInput): Promise<RankerOutput>
}

export type ConsolidatorInput = {
  scope: Scope
  sourceRefs: MemoryRef[]
  sourceObjects: DurableMemoryObject[]
  priorConsolidations?: DurableMemoryObject[]
  policy?: Record<string, unknown>
}

export type ConsolidatorOutput = {
  proposedConsolidations: Array<{
    title?: string
    content: string
    sourceRefs: MemoryRef[]
    supersedes?: MemoryRef[]
    metadata?: Record<string, unknown>
    confidence?: number
  }>
  proposedLinks?: Array<{
    linkType: string
    from: MemoryRef
    to: MemoryRef
    metadata?: Record<string, unknown>
  }>
  warnings?: ContextWarning[]
}

export interface ConsolidatorPlugin {
  descriptor: PluginDescriptor
  consolidate(input: ConsolidatorInput): Promise<ConsolidatorOutput>
}

export type FormatterInput = {
  workingContext: WorkingContext
  target: string
  preferences?: Record<string, unknown>
}

export type FormatterOutput = {
  formatted: unknown
}

export interface FormatterPlugin {
  descriptor: PluginDescriptor
  format(input: FormatterInput): Promise<FormatterOutput>
}
