import type {
  DurableMemoryObject,
  GetJobResponse,
  MemoryRef,
  MemoryType,
  Scope,
} from "./types"

export type EpisodeObject = DurableMemoryObject & {
  type: "episode"
  dedupeKey: string
  contentType: string
  content: unknown
  metadata: Record<string, unknown>
  createdBy: string
}

export type LinkType = "derived_from" | "supports" | "contradicts" | "supersedes" | "mentions" | "same_as" | "corrects" | "invalidates"

export type LinkObject = DurableMemoryObject & {
  type: "link"
  linkType: LinkType
  from: MemoryRef
  to: MemoryRef
  metadata: Record<string, unknown>
}

export type IndexRecord = {
  ref: MemoryRef
  searchableText: string
  indexedAt: string
}

export type QueryCandidate = {
  ref: MemoryRef
  score: number
  reason?: string
}

export type EpisodeStore = {
  appendEpisode(episode: EpisodeObject): Promise<void>
  getByRef(ref: MemoryRef): Promise<EpisodeObject | null>
  getByRefs(refs: MemoryRef[]): Promise<(EpisodeObject | null)[]>
  resolveByDedupeKey(scope: Scope, dedupeKey: string): Promise<EpisodeObject | null>
  tombstone(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found">
  listActive(scope: Scope): Promise<EpisodeObject[]>
}

export type GraphStore = {
  addLink(link: LinkObject): Promise<void>
  outgoing(ref: MemoryRef): Promise<LinkObject[]>
  incoming(ref: MemoryRef): Promise<LinkObject[]>
  tombstoneLink(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found">
}

export type IndexStore = {
  index(record: IndexRecord): Promise<void>
  remove(ref: MemoryRef): Promise<void>
  search(scope: Scope, query: string, limit: number): Promise<QueryCandidate[]>
}

export type MetadataStore = {
  putObject(object: DurableMemoryObject): Promise<void>
  getObject(ref: MemoryRef): Promise<DurableMemoryObject | null>
  getObjects(refs: MemoryRef[]): Promise<(DurableMemoryObject | null)[]>
  listObjectsByScope(scope: Scope): Promise<DurableMemoryObject[]>
  updateStatus(ref: MemoryRef, status: DurableMemoryObject["status"]): Promise<"updated" | "not_found" | "unchanged">

  createJob(job: Omit<GetJobResponse, "createdAt" | "updatedAt">): Promise<GetJobResponse>
  updateJob(jobId: string, updater: (job: GetJobResponse) => GetJobResponse): Promise<GetJobResponse | null>
  getJob(scope: Scope, jobId: string): Promise<GetJobResponse | null>

  nextCursor(scope: Scope, kind: MemoryType | "job" | "event"): Promise<string>
}
