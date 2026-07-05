import type {
  DurableMemoryObject,
  LifecycleStatus,
  MemoryFilters,
  MemoryRef,
  Scope,
} from "./model"

export type AdapterConsistency = "synchronous" | "eventual"

export type AdapterCapabilityDescriptor = {
  implementedPorts: Array<"EpisodeStore" | "GraphStore" | "IndexStore" | "MetadataStore">
  transactionalGuarantees: string[]
  maxObjectSizeBytes?: number
  indexConsistency: AdapterConsistency
  paginationBehavior: string
  supportedFilters: string[]
  backupAndRestore?: string
}

export type ListResult<T> = {
  items: T[]
  cursor?: string
}

export interface EpisodeStore {
  appendEpisode(scope: Scope, object: DurableMemoryObject): Promise<void>
  fetchEpisodeByRef(scope: Scope, ref: MemoryRef): Promise<DurableMemoryObject | null>
  fetchEpisodesByRefs(scope: Scope, refs: MemoryRef[]): Promise<DurableMemoryObject[]>
  resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<MemoryRef | null>
  tombstoneEpisode(scope: Scope, ref: MemoryRef): Promise<void>
}

export interface GraphStore {
  addLink(scope: Scope, link: DurableMemoryObject): Promise<void>
  fetchOutgoingLinks(scope: Scope, from: MemoryRef, filters?: MemoryFilters): Promise<ListResult<DurableMemoryObject>>
  fetchIncomingLinks(scope: Scope, to: MemoryRef, filters?: MemoryFilters): Promise<ListResult<DurableMemoryObject>>
  fetchProvenanceChain(scope: Scope, ref: MemoryRef): Promise<DurableMemoryObject[]>
  tombstoneLink(scope: Scope, ref: MemoryRef): Promise<void>
}

export interface IndexStore {
  indexPayload(scope: Scope, ref: MemoryRef, payload: Record<string, unknown>): Promise<void>
  removeOrHide(scope: Scope, ref: MemoryRef): Promise<void>
  searchByQuery(
    scope: Scope,
    queryPayload: Record<string, unknown>,
    filters?: MemoryFilters,
    limit?: number,
  ): Promise<Array<{ ref: MemoryRef; score: number }>>
  searchByFilters(scope: Scope, filters: MemoryFilters, limit?: number): Promise<MemoryRef[]>
  reportFreshness?(scope: Scope): Promise<{ asOf: string; lagMs?: number }>
}

export interface RuntimeJob {
  id: string
  type: string
  scope: Scope
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export interface MetadataStore {
  storeScope(scope: Scope): Promise<void>
  storeAccessMetadata(scope: Scope, metadata: Record<string, unknown>): Promise<void>
  createJob(job: RuntimeJob): Promise<void>
  updateJob(jobId: string, status: RuntimeJob["status"], metadata?: Record<string, unknown>): Promise<void>
  getJob(scope: Scope, jobId: string): Promise<RuntimeJob | null>
  storePluginState(pluginName: string, state: Record<string, unknown>): Promise<void>
  getPluginState(pluginName: string): Promise<Record<string, unknown> | null>
  storeEventCursor(scope: Scope, stream: string, cursor: string): Promise<void>
  getEventCursor(scope: Scope, stream: string): Promise<string | null>
}

export const defaultRetrievableStatuses: LifecycleStatus[] = ["active"]

export const includeStatus = (status: LifecycleStatus, statuses: LifecycleStatus[] = defaultRetrievableStatuses): boolean =>
  statuses.includes(status)
