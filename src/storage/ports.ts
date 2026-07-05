import type { DurableMemoryObject, MemoryRef, Scope } from "../domain/types"

export type EpisodeStore = {
  append: (object: DurableMemoryObject & { type: "episode"; dedupeKey?: string }) => Promise<void>
  findByRef: (scope: Scope, ref: MemoryRef) => Promise<DurableMemoryObject | null>
  findByRefs: (scope: Scope, refs: MemoryRef[]) => Promise<DurableMemoryObject[]>
  findByDedupeKey: (scope: Scope, dedupeKey: string) => Promise<DurableMemoryObject | null>
  tombstone: (scope: Scope, ref: MemoryRef) => Promise<boolean>
  listByScope: (scope: Scope) => Promise<DurableMemoryObject[]>
}

export type GraphLink = {
  id: string
  scope: Scope
  from: MemoryRef
  to: MemoryRef
  linkType: string
  status: "active" | "tombstoned"
  createdAt: string
}

export type GraphStore = {
  addLink: (link: GraphLink) => Promise<void>
  getOutgoing: (scope: Scope, from: MemoryRef) => Promise<GraphLink[]>
  getIncoming: (scope: Scope, to: MemoryRef) => Promise<GraphLink[]>
  tombstoneLink: (scope: Scope, linkId: string) => Promise<boolean>
}

export type IndexItem = {
  ref: MemoryRef
  text: string
  status: "active" | "tombstoned"
  updatedAt: string
}

export type IndexStore = {
  index: (scope: Scope, item: IndexItem) => Promise<void>
  remove: (scope: Scope, ref: MemoryRef) => Promise<void>
  search: (scope: Scope, query: string, limit: number) => Promise<{ ref: MemoryRef; score: number }[]>
}

export type JobRecord = {
  jobId: string
  scope: Scope
  type: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: { code: string; message: string; retryable: boolean }
}

export type MetadataStore = {
  putJob: (job: JobRecord) => Promise<void>
  getJob: (scope: Scope, jobId: string) => Promise<JobRecord | null>
}

export type StoragePorts = {
  episodes: EpisodeStore
  graph: GraphStore
  index: IndexStore
  metadata: MetadataStore
}
