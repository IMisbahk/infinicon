export type ConsistencyMode = "accepted" | "indexed"
export type ReadConsistency = "strong" | "eventual"

export type Scope = {
  tenantId: string
  namespaceId: string
  agentId?: string
  sessionId?: string
  filters?: Record<string, unknown>
}

export type ActorRef = {
  id: string
  type?: string
}

export type MemoryObjectType = "episode" | "atom" | "consolidation" | "link"

export type MemoryStatus =
  | "active"
  | "disputed"
  | "superseded"
  | "tombstoned"
  | "pending"
  | "failed"

export type MemoryRef = {
  id: string
  type: MemoryObjectType
  scope: Scope
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
}

export type MemoryApiError = {
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export type Provenance = {
  sourceRefs: MemoryRef[]
  producedBy: string
  createdAt: string
  transformationType: string
  confidence?: number
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
  status: MemoryStatus
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
  status: MemoryStatus
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
  includeTypes?: MemoryObjectType[]
  includeStatuses?: MemoryStatus[]
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
  consistency?: ConsistencyMode
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
  consistency?: ReadConsistency
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
  consistency?: ReadConsistency
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
  eventTypes?: MemoryEventType[]
  cursor?: string
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
  eventId: string
  type: MemoryEventType
  scope: Scope
  at: string
  payload: Record<string, unknown>
}

export type GetJobRequest = {
  scope: Scope
  jobId: string
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export type JobRecord = {
  jobId: string
  type: string
  scope: Scope
  status: JobStatus
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: MemoryApiError
}

export type GetJobResponse = JobRecord
