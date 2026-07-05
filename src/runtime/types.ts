export type Scope = {
  tenantId: string
  namespaceId: string
  agentId?: string
  sessionId?: string
}

export type MemoryType = "episode" | "atom" | "consolidation" | "link"

export type LifecycleStatus = "active" | "disputed" | "superseded" | "tombstoned" | "pending" | "failed"

export type MemoryRef = {
  id: string
  type: MemoryType
  scope: Scope
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
  dedupeKey: string
  createdBy: string
  metadata: Record<string, unknown>
}

export type IngestRequest = {
  scope: Scope
  episodes: IngestEpisode[]
  consistency?: "accepted" | "indexed"
}

export type IngestResult = {
  ref: MemoryRef
  status: "created" | "deduplicated" | "rejected"
  error?: MemoryApiError
}

export type IngestResponse = {
  results: IngestResult[]
}

export type MemoryFilters = {
  includeDisputed?: boolean
  includeSuperseded?: boolean
}

export type QueryRequest = {
  scope: Scope
  query: string
  filters?: MemoryFilters
  limit?: number
  consistency?: "strong" | "eventual"
}

export type QueryRefResult = {
  ref: MemoryRef
  score: number
  reason?: string
  warnings?: ContextWarning[]
}

export type QueryResponse = {
  refs: QueryRefResult[]
  cursor?: string
}

export type HydrateRequest = {
  scope: Scope
  refs: MemoryRef[]
  includeProvenance?: boolean
}

export type DurableMemoryObject = {
  id: string
  type: MemoryType
  scope: Scope
  status: LifecycleStatus
  createdAt: string
  updatedAt?: string
  [key: string]: unknown
}

export type HydrateResponse = {
  objects: DurableMemoryObject[]
  missing: MemoryRef[]
}

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
  message?: string
  details?: Record<string, unknown>
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
  reason?: string
  provenance?: Record<string, unknown>
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

export type TombstoneRequest = {
  scope: Scope
  refs: MemoryRef[]
  reason: string
  cascadePolicy: "none" | "mark_derived_stale" | "tombstone_derived"
}

export type TombstoneResult = {
  ref: MemoryRef
  status: "tombstoned" | "already_tombstoned" | "not_found" | "rejected"
  affectedDerivedRefs?: MemoryRef[]
  error?: MemoryApiError
}

export type TombstoneResponse = {
  results: TombstoneResult[]
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

export type MemoryEvent = {
  type: MemoryEventType
  scope: Scope
  ref?: MemoryRef
  cursor: string
  emittedAt: string
  payload?: Record<string, unknown>
}

export type SubscribeRequest = {
  scope: Scope
  eventTypes?: MemoryEventType[]
  cursor?: string
}

export type SubscribeResponse = {
  subscriptionId: string
}

export type GetJobRequest = {
  scope: Scope
  jobId: string
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export type GetJobResponse = {
  jobId: string
  type: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: MemoryApiError
}

export type ApiResult<T> = {
  ok: true
  value: T
} | {
  ok: false
  error: MemoryApiError
}
