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

export type MemoryObjectType = "episode" | "atom" | "consolidation" | "link"

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

export type ActorRef = {
  id: string
  kind?: string
}

export type DurableBase = {
  id: string
  type: MemoryObjectType
  scope: Scope
  createdAt: string
  createdBy: ActorRef
  status: LifecycleStatus
  metadata: Record<string, unknown>
  updatedAt?: string
  schemaVersion?: string
}

export type Episode = DurableBase & {
  type: "episode"
  contentType: string
  content: unknown
  dedupeKey?: string
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

export type Link = DurableBase & {
  type: "link"
  status: "active" | "tombstoned"
  linkType: LinkType
  from: MemoryRef
  to: MemoryRef
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

export type ContextBudget = {
  maxTokens: number
  maxSegments?: number
  reserveTokens?: number
}

export type MemoryFilters = {
  includeDisputed?: boolean
  includeSuperseded?: boolean
}

export type ContextConstraints = {
  mustIncludeRefs?: MemoryRef[]
  excludedRefs?: MemoryRef[]
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

export type QueryRef = {
  ref: MemoryRef
  score: number
  reason?: string
  warnings?: ContextWarning[]
}

export type QueryResponse = {
  refs: QueryRef[]
  cursor?: string
}

export type HydrateRequest = {
  scope: Scope
  refs: MemoryRef[]
  includeProvenance?: boolean
}

export type HydrateResponse = {
  objects: Episode[]
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

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled"

export type ConsolidateResponse = {
  jobId: string
  status: Extract<JobStatus, "queued" | "running" | "completed" | "failed">
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
  id: string
  scope: Scope
  type: MemoryEventType
  at: string
  payload: Record<string, unknown>
  cursor: string
}

export type SubscribeRequest = {
  scope: Scope
  eventTypes?: MemoryEventType[]
  cursor?: string
}

export type SubscribeResponse = {
  events: MemoryEvent[]
  cursor?: string
}

export type GetJobRequest = {
  scope: Scope
  jobId: string
}

export type JobRecord = {
  jobId: string
  scope: Scope
  type: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: MemoryApiError
}

export type GetJobResponse = JobRecord

export type RuntimePortError = {
  code: string
  message: string
}

export type Result<T, E> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: E
    }

export type EpisodeStore = {
  appendEpisode(episode: Episode): Promise<void>
  getEpisodeByRef(ref: MemoryRef): Promise<Episode | null>
  getEpisodesByRefs(refs: MemoryRef[]): Promise<(Episode | null)[]>
  resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<Episode | null>
  tombstoneEpisode(ref: MemoryRef): Promise<boolean>
  queryEpisodes(req: QueryRequest): Promise<Episode[]>
}

export type GraphStore = {
  addLink(link: Link): Promise<void>
  fetchOutgoing(ref: MemoryRef): Promise<Link[]>
  fetchIncoming(ref: MemoryRef): Promise<Link[]>
  fetchProvenanceChain(ref: MemoryRef, maxDepth?: number): Promise<Link[]>
  tombstoneLink(linkId: string, scope: Scope): Promise<boolean>
}

export type IndexSearchResult = {
  ref: MemoryRef
  score: number
  reason: string
}

export type IndexStore = {
  indexEpisode(episode: Episode): Promise<void>
  removeEpisode(ref: MemoryRef): Promise<void>
  search(req: QueryRequest): Promise<IndexSearchResult[]>
}

export type MetadataStore = {
  createJob(job: JobRecord): Promise<void>
  updateJob(job: JobRecord): Promise<void>
  getJob(scope: Scope, jobId: string): Promise<JobRecord | null>
  appendEvent(event: MemoryEvent): Promise<void>
  listEvents(req: SubscribeRequest): Promise<MemoryEvent[]>
}

export type IdFactory = {
  next(): string
}
