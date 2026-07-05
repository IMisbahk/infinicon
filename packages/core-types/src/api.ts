import type {
  ContextBudget,
  ContextConstraints,
  ContextWarning,
  DurableMemoryObject,
  MemoryFilters,
  MemoryRef,
  Scope,
  WorkingContext,
} from "./model"

import type { ActorRef } from "./model"

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
  consistency?: "strong" | "eventual"
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

export type TombstoneResult = {
  ref: MemoryRef
  status: "tombstoned" | "already_tombstoned" | "not_found" | "rejected"
  affectedDerivedRefs?: MemoryRef[]
  error?: MemoryApiError
}

export type TombstoneResponse = {
  results: TombstoneResult[]
  jobId?: string
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

export interface MemoryApiContract {
  ingest(request: IngestRequest): Promise<IngestResponse>
  query(request: QueryRequest): Promise<QueryResponse>
  hydrate(request: HydrateRequest): Promise<HydrateResponse>
  assembleContext(request: AssembleContextRequest): Promise<AssembleContextResponse>
  consolidate(request: ConsolidateRequest): Promise<ConsolidateResponse>
  tombstone(request: TombstoneRequest): Promise<TombstoneResponse>
  subscribe(request: SubscribeRequest): AsyncIterable<MemoryLifecycleEvent>
  getJob(request: GetJobRequest): Promise<GetJobResponse>
}

export type MemoryLifecycleEvent = {
  type: MemoryEventType | string
  scope: Scope
  ref?: MemoryRef
  timestamp: string
  cursor?: string
  payload?: Record<string, unknown>
}
