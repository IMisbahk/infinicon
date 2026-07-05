export type ConsistencyMode = "strong" | "eventual"

export type Scope = {
  tenantId: string
  namespaceId: string
  agentId?: string
  sessionId?: string
}

export type LifecycleStatus =
  | "active"
  | "disputed"
  | "superseded"
  | "tombstoned"
  | "pending"
  | "failed"

export type ActorRef = {
  id: string
  type: string
}

export type MemoryType = "episode" | "atom" | "consolidation" | "link"

export type MemoryRef = {
  id: string
  type: MemoryType
  scope: Scope
}

export type DurableMemoryBase = {
  id: string
  type: MemoryType
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: LifecycleStatus
  metadata: Record<string, unknown>
  updatedAt?: string
}

export type Episode = DurableMemoryBase & {
  type: "episode"
  contentType: string
  content: unknown
  dedupeKey?: string
}

export type DurableMemoryObject = Episode

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

export type ContextWarning =
  | "empty_context"
  | "truncated"
  | "required_ref_omitted"
  | "stale_consolidation"
  | "disputed_memory_included"
  | "superseded_memory_included"
  | "eventual_consistency"
  | "partial_hydration"

export type MemoryEvent = {
  type: MemoryEventType
  scope: Scope
  cursor: string
  occurredAt: string
  ref?: MemoryRef
  jobId?: string
  warnings?: ContextWarning[]
  metadata?: Record<string, unknown>
}

export type MemoryApiError = {
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export type MemoryFilters = {
  statuses?: LifecycleStatus[]
  includeDisputed?: boolean
  includeSuperseded?: boolean
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
  consistency?: ConsistencyMode
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

export type ContextBudget = {
  maxTokenEstimate: number
  maxSegments?: number
  reservedTokens?: number
}

export type ContextConstraints = {
  mustIncludeRefs?: MemoryRef[]
  excludedRefs?: MemoryRef[]
  includeDisputed?: boolean
  preferRecency?: boolean
  preferHighConfidence?: boolean
  maxSegments?: number
}

export type ContextSegment = {
  ref: MemoryRef
  content: unknown
  score: number
  reason: string
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

export type AssembleContextRequest = {
  scope: Scope
  task: string
  budget: ContextBudget
  filters?: MemoryFilters
  constraints?: ContextConstraints
  consistency?: ConsistencyMode
}

export type AssembleContextResponse = {
  context: WorkingContext
}

export type TombstoneRequest = {
  scope: Scope
  refs: MemoryRef[]
  reason: string
  cascadePolicy: "none" | "mark_derived_stale" | "tombstone_derived"
}

export type TombstoneResponse = {
  results: {
    ref: MemoryRef
    status: "tombstoned" | "already_tombstoned" | "not_found" | "rejected"
    affectedDerivedRefs?: MemoryRef[]
    error?: MemoryApiError
  }[]
}

export type SubscribeRequest = {
  scope: Scope
  eventTypes?: MemoryEventType[]
  cursor?: string
  consistency?: ConsistencyMode
}

export type SubscribeResponse = {
  events: MemoryEvent[]
  nextCursor?: string
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
