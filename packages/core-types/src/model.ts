export type ObjectId = string
export type TimestampIso8601 = string

export type MemoryObjectType = "episode" | "atom" | "consolidation" | "link"

export type Scope = {
  tenantId: string
  namespaceId: string
  agentId?: string
  sessionId?: string
  filters?: Record<string, unknown>
}

export type ActorRef = {
  id: string
  kind: "user" | "agent" | "system" | "plugin"
}

export type LifecycleStatus =
  | "active"
  | "disputed"
  | "superseded"
  | "tombstoned"
  | "pending"
  | "failed"

export type MemoryRef = {
  id: ObjectId
  type: MemoryObjectType
  scope: Scope
}

export type Provenance = {
  sourceRefs: MemoryRef[]
  producedBy: ActorRef
  createdAt: TimestampIso8601
  transformation: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export type SharedMemoryFields = {
  id: ObjectId
  type: MemoryObjectType
  scope: Scope
  createdAt: TimestampIso8601
  createdBy: ActorRef
  status: LifecycleStatus
  metadata: Record<string, unknown>
  updatedAt?: TimestampIso8601
  schemaVersion?: string
  provenance?: Provenance
}

export type Episode = SharedMemoryFields & {
  type: "episode"
  status: "active" | "tombstoned" | "pending" | "failed"
  dedupeKey?: string
  contentType: string
  content: unknown
}

export type Atom = SharedMemoryFields & {
  type: "atom"
  atomType: string
  content: string
  confidence?: number
  provenance: Provenance
}

export type Consolidation = SharedMemoryFields & {
  type: "consolidation"
  title?: string
  content: string
  sourceRefs: MemoryRef[]
  supersedes?: MemoryRef[]
  provenance: Provenance
}

export type LinkType =
  | "derived_from"
  | "supports"
  | "contradicts"
  | "supersedes"
  | "mentions"
  | "same_as"
  | "corrects"
  | "invalidates"

export type Link = SharedMemoryFields & {
  type: "link"
  status: "active" | "tombstoned"
  linkType: LinkType | string
  from: MemoryRef
  to: MemoryRef
}

export type DurableMemoryObject = Episode | Atom | Consolidation | Link

export type ContextWarningCode =
  | "empty_context"
  | "truncated"
  | "required_ref_omitted"
  | "stale_consolidation"
  | "disputed_memory_included"
  | "superseded_memory_included"
  | "eventual_consistency"
  | "partial_hydration"

export type ContextWarning = {
  code: ContextWarningCode | string
  message: string
  refs?: MemoryRef[]
  metadata?: Record<string, unknown>
}

export type ContextBudget = {
  maxTokens: number
  maxSegments?: number
  reservedTokens?: number
  tokenizer?: string
}

export type ContextConstraints = {
  mustIncludeRefs?: MemoryRef[]
  excludedRefs?: MemoryRef[]
  includeDisputed?: boolean
  includeSuperseded?: boolean
  allowStale?: boolean
  preferRecency?: boolean
  preferHighConfidence?: boolean
  maxSegments?: number
}

export type MemoryFilters = {
  types?: MemoryObjectType[]
  statuses?: LifecycleStatus[]
  includeDisputed?: boolean
  includeSuperseded?: boolean
  includeTombstoned?: boolean
  createdAfter?: TimestampIso8601
  createdBefore?: TimestampIso8601
  metadata?: Record<string, unknown>
}

export type ContextSegment = {
  ref: MemoryRef
  content: unknown
  score: number
  reason?: string
  provenance?: Provenance
}

export type WorkingContext = {
  scope: Scope
  task: string
  budget: ContextBudget
  segments: ContextSegment[]
  tokenEstimate: number
  truncated: boolean
  warnings: ContextWarning[]
  generatedAt: TimestampIso8601
}
