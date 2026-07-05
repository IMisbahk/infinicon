import type {
  DurableMemoryObject,
  Episode,
  Link,
  MemoryEvent,
  MemoryFilters,
  MemoryRef,
  Scope,
} from "./types-reference"

export type AdapterCapabilityDescriptor = {
  implementedPorts: Array<"EpisodeStore" | "GraphStore" | "IndexStore" | "MetadataStore">
  transactionalGuarantees: string[]
  maxObjectSizeBytes?: number
  indexConsistency: "synchronous" | "eventual"
  paginationBehavior: "offset" | "cursor" | "none"
  supportedFilters: string[]
}

export interface EpisodeStore {
  appendEpisode(episode: Episode): Promise<void>
  getEpisode(ref: MemoryRef): Promise<Episode | null>
  getEpisodes(refs: MemoryRef[]): Promise<Episode[]>
  listEpisodes(scope: Scope): Promise<Episode[]>
  resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<Episode | null>
  tombstoneEpisode(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found">
}

export interface GraphStore {
  addLink(link: Link): Promise<void>
  getOutgoingLinks(ref: MemoryRef): Promise<Link[]>
  getIncomingLinks(ref: MemoryRef): Promise<Link[]>
  getProvenanceChain(ref: MemoryRef, maxDepth?: number): Promise<Link[]>
  listLinks(scope: Scope): Promise<Link[]>
  tombstoneLink(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found">
}

export type IndexPayload = {
  ref: MemoryRef
  text: string
  metadata?: Record<string, unknown>
}

export type IndexedCandidate = {
  ref: MemoryRef
  score: number
  reason: string
}

export interface IndexStore {
  indexMemory(payload: IndexPayload): Promise<void>
  removeIndexed(ref: MemoryRef): Promise<void>
  search(scope: Scope, query: string, filters?: MemoryFilters, limit?: number): Promise<IndexedCandidate[]>
  reportFreshness(scope: Scope): Promise<"fresh" | "stale" | "unknown">
}

export type JobRecord = {
  jobId: string
  type: string
  scope: Scope
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: { code: string; message: string; retryable: boolean; details?: Record<string, unknown> }
}

export interface MetadataStore {
  storeScope(scope: Scope): Promise<void>
  hasScope(scope: Scope): Promise<boolean>
  upsertJob(job: JobRecord): Promise<void>
  getJob(scope: Scope, jobId: string): Promise<JobRecord | null>
  appendEvent(event: MemoryEvent): Promise<void>
  listEvents(scope: Scope, cursor?: string): Promise<MemoryEvent[]>
}

export interface ObjectStore {
  upsert(object: DurableMemoryObject): Promise<void>
  get(ref: MemoryRef): Promise<DurableMemoryObject | null>
  getMany(refs: MemoryRef[]): Promise<DurableMemoryObject[]>
  list(scope: Scope): Promise<DurableMemoryObject[]>
}
