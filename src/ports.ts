import type {
  DurableMemoryObject,
  Episode,
  MemoryEvent,
  MemoryEventType,
  MemoryRef,
  Scope,
} from "./types"

export type EpisodeStore = {
  appendEpisode(episode: Episode): Promise<void>
  getEpisode(ref: MemoryRef): Promise<Episode | undefined>
  getEpisodes(refs: MemoryRef[]): Promise<(Episode | undefined)[]>
  resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<MemoryRef | undefined>
  tombstoneEpisode(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found">
  listEpisodesByScope(scope: Scope): Promise<Episode[]>
}

export type GraphStore = {
  // no-op for events-first skeleton
  ping(): Promise<void>
}

export type IndexCandidate = {
  ref: MemoryRef
  score: number
  reason?: string
}

export type IndexStore = {
  indexMemory(memory: DurableMemoryObject): Promise<void>
  removeMemory(ref: MemoryRef): Promise<void>
  search(scope: Scope, query: string, limit: number): Promise<IndexCandidate[]>
}

export type MetadataStore = {
  appendLifecycleEvent(event: Omit<MemoryEvent, "cursor">): Promise<MemoryEvent>
  readLifecycleEventsFromCursor(input: {
    scope: Scope
    cursor?: string
    limit: number
    eventTypes?: MemoryEventType[]
  }): Promise<{ events: MemoryEvent[]; nextCursor?: string }>
  isCursorValidForScope(scope: Scope, cursor: string): Promise<boolean>
  isCursorKnown(cursor: string): Promise<boolean>
}
