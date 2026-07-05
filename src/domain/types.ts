export type ConsistencyWrite = "accepted" | "indexed"
export type ConsistencyRead = "strong" | "eventual"

export type Scope = {
  tenantId: string
  namespaceId: string
  agentId?: string
  sessionId?: string
}

export type ActorRef = {
  id: string
  kind: string
}

export type MemoryStatus = "active" | "disputed" | "superseded" | "tombstoned" | "pending" | "failed"
export type MemoryRefType = "episode" | "atom" | "consolidation" | "link"

export type MemoryRef = {
  id: string
  type: MemoryRefType
  scope: Scope
}

export type MemoryApiError = {
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
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
}

export type IngestEpisode = {
  contentType: string
  content: unknown
  dedupeKey: string
  createdBy: ActorRef
  metadata: Record<string, unknown>
}

export type IngestRequest = {
  scope: Scope
  episodes: IngestEpisode[]
  consistency?: ConsistencyWrite
}

export type IngestResponse = {
  results: {
    ref: MemoryRef
    status: "created" | "deduplicated" | "rejected"
    error?: MemoryApiError
  }[]
}

export type MemoryFilters = {
  includeDisputed?: boolean
  includeSuperseded?: boolean
  types?: MemoryRefType[]
  metadata?: Record<string, unknown>
}

export type QueryRequest = {
  scope: Scope
  query: string
  filters?: MemoryFilters
  limit?: number
  consistency?: ConsistencyRead
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

export type DurableMemoryObject = {
  id: string
  type: MemoryRefType
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: MemoryStatus
  metadata: Record<string, unknown>
  content?: unknown
  provenance?: Record<string, unknown>
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

export type ContextConstraints = {
  mustIncludeRefs?: MemoryRef[]
  excludedRefs?: MemoryRef[]
  includeDisputed?: boolean
  preferRecency?: boolean
  preferHighConfidence?: boolean
  maxSegments?: number
}

export type AssembleContextRequest = {
  scope: Scope
  task: string
  budget: ContextBudget
  filters?: MemoryFilters
  constraints?: ContextConstraints
  consistency?: ConsistencyRead
}

export type ContextSegment = {
  ref: MemoryRef
  content: string
  score: number
  reason: string
  provenance: Record<string, unknown>
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
  eventTypes?: (
    | "episode.ingested"
    | "atom.extracted"
    | "memory.indexed"
    | "consolidation.started"
    | "consolidation.completed"
    | "consolidation.failed"
    | "memory.disputed"
    | "memory.superseded"
    | "memory.tombstoned"
  )[]
  cursor?: string
}

export type SubscribeResponse = {
  subscriptionId: string
  accepted: boolean
  cursor?: string
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
