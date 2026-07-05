export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type Scope = {
  tenantId: string
  namespaceId: string
  agentId?: string
  sessionId?: string
  filters?: Record<string, JsonValue>
}

export type MemoryObjectType = "episode" | "atom" | "consolidation" | "link"

export type ConsistencyPreference = "strong" | "eventual"

export type IngestConsistency = "accepted" | "indexed"

export type MemoryRef = {
  id: string
  type: MemoryObjectType
  scope: Scope
}

export type MemoryApiError = {
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export type LifecycleStatus =
  | "active"
  | "disputed"
  | "superseded"
  | "tombstoned"
  | "pending"
  | "failed"

export type ContentEnvelope = {
  contentType: string
  content: unknown
}

export type Provenance = {
  sourceRefs: MemoryRef[]
  actor?: string
  transformationType?: string
  createdAt?: string
  confidence?: number
  metadata?: Record<string, JsonValue>
}

export type DurableMemoryObject = {
  id: string
  type: MemoryObjectType
  scope: Scope
  createdAt: string
  createdBy: string
  status: LifecycleStatus
  metadata: Record<string, JsonValue>
  updatedAt?: string
  schemaVersion?: string
  provenance?: Provenance
  content?: unknown
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
  code: ContextWarningCode | (string & {})
  message: string
  metadata?: Record<string, JsonValue>
}

export type ContextBudget = {
  maxTokens: number
  maxSegments?: number
  reservedTokens?: number
}

export type ContextConstraints = {
  requiredRefs?: MemoryRef[]
  excludedRefs?: MemoryRef[]
  includeDisputed?: boolean
  includeSuperseded?: boolean
  preferRecency?: boolean
  preferHighConfidence?: boolean
  maxSegments?: number
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
  generatedAt: string
}

export type MemoryFilters = {
  types?: MemoryObjectType[]
  statuses?: LifecycleStatus[]
  includeDisputed?: boolean
  includeSuperseded?: boolean
  metadata?: Record<string, JsonValue>
}

export type IngestEpisode = {
  contentType: string
  content: unknown
  dedupeKey?: string
  createdBy: string
  metadata?: Record<string, JsonValue>
}

export type IngestRequest = {
  scope: Scope
  episodes: IngestEpisode[]
  consistency?: IngestConsistency
}

export type IngestResult = {
  ref: MemoryRef
  status: "created" | "deduplicated" | "rejected"
  error?: MemoryApiError
}

export type IngestResponse = {
  results: IngestResult[]
}

export type QueryRequest = {
  scope: Scope
  query: string
  filters?: MemoryFilters
  limit?: number
  consistency?: ConsistencyPreference
}

export type QueryResult = {
  ref: MemoryRef
  score: number
  reason?: string
  warnings?: ContextWarning[]
}

export type QueryResponse = {
  refs: QueryResult[]
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
  consistency?: ConsistencyPreference
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

export type TombstoneCascadePolicy =
  | "none"
  | "mark_derived_stale"
  | "tombstone_derived"

export type TombstoneRequest = {
  scope: Scope
  refs: MemoryRef[]
  reason: string
  cascadePolicy: TombstoneCascadePolicy
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

export type SubscribeRequest = {
  scope: Scope
  eventTypes?: MemoryEventType[]
  cursor?: string
}

export type SubscribeResponse = {
  cursor?: string
  accepted?: boolean
  events?: Array<{
    type: MemoryEventType | (string & {})
    cursor?: string
    createdAt?: string
    payload?: unknown
  }>
}

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type GetJobRequest = {
  scope: Scope
  jobId: string
}

export type GetJobResponse = {
  jobId: string
  type: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: MemoryApiError
}
