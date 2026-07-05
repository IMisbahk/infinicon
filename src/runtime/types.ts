export type LifecycleStatus =
  | "active"
  | "disputed"
  | "superseded"
  | "tombstoned"
  | "pending"
  | "failed"

export type Scope = {
  tenantId: string
  namespaceId: string
  agentId?: string
  sessionId?: string
  filters?: Record<string, unknown>
}

export type ActorRef = {
  id: string
  type: "agent" | "user" | "system" | "plugin"
}

export type MemoryType = "episode" | "atom" | "consolidation" | "link"

export type MemoryRef = {
  id: string
  type: MemoryType
  scope: Scope
}

export type Provenance = {
  sourceRefs: MemoryRef[]
  createdBy: ActorRef
  createdAt: string
  transformationType: string
  confidence?: number
  metadata?: Record<string, unknown>
}

export type Episode = {
  id: string
  type: "episode"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: "active" | "tombstoned" | "pending" | "failed"
  dedupeKey?: string
  contentType: string
  content: unknown
  metadata: Record<string, unknown>
}

export type Atom = {
  id: string
  type: "atom"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: LifecycleStatus
  atomType: string
  content: string
  confidence?: number
  provenance: Provenance
  metadata: Record<string, unknown>
}

export type Consolidation = {
  id: string
  type: "consolidation"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: LifecycleStatus
  title?: string
  content: string
  sourceRefs: MemoryRef[]
  supersedes?: MemoryRef[]
  provenance: Provenance
  metadata: Record<string, unknown>
}

export type Link = {
  id: string
  type: "link"
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: "active" | "tombstoned"
  linkType: string
  from: MemoryRef
  to: MemoryRef
  metadata: Record<string, unknown>
}

export type DurableMemoryObject = Episode | Atom | Consolidation | Link

export type ContextBudget = {
  maxTokens: number
  maxSegments?: number
  reservedTokens?: number
}

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
  code: ContextWarningCode
  message: string
  metadata?: Record<string, unknown>
}

export type ContextSegment = {
  ref: MemoryRef
  content: unknown
  score: number
  reason: string
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
  generatedAt: string
}

export type MemoryFilters = {
  includeDisputed?: boolean
  includeSuperseded?: boolean
  includeTombstoned?: boolean
  allowedTypes?: MemoryType[]
}

export type ContextConstraints = {
  mustIncludeRefs?: MemoryRef[]
  excludedRefs?: MemoryRef[]
  includeDisputed?: boolean
  preferRecency?: boolean
  preferHighConfidence?: boolean
  maxSegments?: number
}

export type MemoryApiError = {
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export type IngestEpisode = {
  contentType: string
  content: unknown
  dedupeKey?: string
  createdBy: ActorRef
  metadata?: Record<string, unknown>
}

export type IngestRequest = {
  scope: Scope
  episodes: IngestEpisode[]
  consistency?: "accepted" | "indexed"
}

export type IngestResponse = {
  results: {
    ref: MemoryRef
    status: "created" | "deduplicated" | "rejected"
    error?: MemoryApiError
  }[]
}

export type QueryRequest = {
  scope: Scope
  query: string
  filters?: MemoryFilters
  limit?: number
  consistency?: "strong" | "eventual"
}

export type QueryResponse = {
  refs: {
    ref: MemoryRef
    score: number
    reason?: string
    warnings?: ContextWarning[]
  }[]
  cursor?: string
}

export type HydrateRequest = {
  scope: Scope
  refs: MemoryRef[]
  includeProvenance?: boolean
}

export type HydrateResponse = {
  objects: DurableMemoryObject[]
  missing: MemoryRef[]
}

export type AssembleContextRequest = {
  scope: Scope
  task: string
  budget: ContextBudget
  filters?: MemoryFilters
  constraints?: ContextConstraints
  consistency?: "strong" | "eventual"
}

export type AssembleContextResponse = {
  context: WorkingContext
}

export type ConsolidateRequest = {
  scope: Scope
  trigger: "manual" | "scheduled" | "threshold" | "idle"
  filters?: MemoryFilters
  mode?: "enqueue" | "run_now"
}

export type ConsolidateResponse = {
  jobId: string
  status: "queued" | "running" | "completed" | "failed"
}

export type TombstoneCascadePolicy = "none" | "mark_derived_stale" | "tombstone_derived"

export type TombstoneRequest = {
  scope: Scope
  refs: MemoryRef[]
  reason: string
  cascadePolicy: TombstoneCascadePolicy
}

export type TombstoneResponse = {
  results: {
    ref: MemoryRef
    status: "tombstoned" | "already_tombstoned" | "not_found" | "rejected"
    affectedDerivedRefs?: MemoryRef[]
    error?: MemoryApiError
  }[]
}

export type MemoryEventType =
  | "episode.ingested"
  | "atom.extracted"
  | "memory.indexed"
  | "consolidation.started"
  | "consolidation.completed"
  | "consolidation.failed"
  | "memory.disputed"
  | "memory.superseded"
  | "memory.tombstoned"

export type SubscribeRequest = {
  scope: Scope
  eventTypes?: MemoryEventType[]
  cursor?: string
}

export type MemoryEvent = {
  id: string
  type: MemoryEventType
  scope: Scope
  timestamp: string
  payload: Record<string, unknown>
}

export type SubscribeResponse = MemoryEvent[]

export type GetJobRequest = {
  scope: Scope
  jobId: string
}

export type GetJobResponse = {
  jobId: string
  type: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: MemoryApiError
}
