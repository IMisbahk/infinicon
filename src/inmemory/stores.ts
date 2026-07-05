import type {
  DurableMemoryObject,
  Episode,
  MemoryEvent,
  MemoryEventType,
  MemoryRef,
  Scope,
} from "../types"
import type { EpisodeStore, GraphStore, IndexCandidate, IndexStore, MetadataStore } from "../ports"

const scopeKey = (scope: Scope): string => {
  const agent = scope.agentId ?? ""
  const session = scope.sessionId ?? ""
  return `${scope.tenantId}::${scope.namespaceId}::${agent}::${session}`
}

const refKey = (ref: MemoryRef): string => `${scopeKey(ref.scope)}::${ref.type}::${ref.id}`

const hasSameScope = (a: Scope, b: Scope): boolean =>
  a.tenantId === b.tenantId &&
  a.namespaceId === b.namespaceId &&
  (a.agentId ?? "") === (b.agentId ?? "") &&
  (a.sessionId ?? "") === (b.sessionId ?? "")

const tokenize = (value: unknown): string[] => {
  const raw = typeof value === "string" ? value : JSON.stringify(value)
  return raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

export class InMemoryEpisodeStore implements EpisodeStore {
  private readonly episodes = new Map<string, Episode>()
  private readonly dedupe = new Map<string, MemoryRef>()

  async appendEpisode(episode: Episode): Promise<void> {
    const key = refKey({ id: episode.id, type: "episode", scope: episode.scope })
    this.episodes.set(key, episode)
    if (episode.dedupeKey) {
      this.dedupe.set(`${scopeKey(episode.scope)}::${episode.dedupeKey}`, {
        id: episode.id,
        type: "episode",
        scope: episode.scope,
      })
    }
  }

  async getEpisode(ref: MemoryRef): Promise<Episode | undefined> {
    if (ref.type !== "episode") return undefined
    return this.episodes.get(refKey(ref))
  }

  async getEpisodes(refs: MemoryRef[]): Promise<(Episode | undefined)[]> {
    return Promise.all(refs.map((ref) => this.getEpisode(ref)))
  }

  async resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<MemoryRef | undefined> {
    return this.dedupe.get(`${scopeKey(scope)}::${dedupeKey}`)
  }

  async tombstoneEpisode(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found"> {
    const existing = await this.getEpisode(ref)
    if (!existing) return "not_found"
    if (existing.status === "tombstoned") return "already_tombstoned"
    this.episodes.set(refKey(ref), {
      ...existing,
      status: "tombstoned",
      updatedAt: new Date().toISOString(),
    })
    return "tombstoned"
  }

  async listEpisodesByScope(scope: Scope): Promise<Episode[]> {
    const all = Array.from(this.episodes.values())
    return all.filter((episode) => hasSameScope(episode.scope, scope))
  }
}

export class InMemoryGraphStore implements GraphStore {
  async ping(): Promise<void> {
    return
  }
}

export class InMemoryIndexStore implements IndexStore {
  private readonly index = new Map<string, { object: DurableMemoryObject; tokens: string[] }>()

  async indexMemory(memory: DurableMemoryObject): Promise<void> {
    this.index.set(refKey({ id: memory.id, type: memory.type, scope: memory.scope }), {
      object: memory,
      tokens: tokenize(memory.content),
    })
  }

  async removeMemory(ref: MemoryRef): Promise<void> {
    this.index.delete(refKey(ref))
  }

  async search(scope: Scope, query: string, limit: number): Promise<IndexCandidate[]> {
    const queryTokens = tokenize(query)
    const candidates: IndexCandidate[] = []

    for (const { object, tokens } of this.index.values()) {
      if (!hasSameScope(object.scope, scope)) continue
      if (object.status === "tombstoned") continue
      const overlap = queryTokens.filter((token) => tokens.includes(token)).length
      if (overlap <= 0) continue
      candidates.push({
        ref: {
          id: object.id,
          type: object.type,
          scope: object.scope,
        },
        score: overlap / Math.max(1, queryTokens.length),
        reason: "token_overlap",
      })
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, limit)
  }
}

export class InMemoryMetadataStore implements MetadataStore {
  private readonly events: MemoryEvent[] = []
  private cursor = 0

  async appendLifecycleEvent(event: Omit<MemoryEvent, "cursor">): Promise<MemoryEvent> {
    const next: MemoryEvent = {
      ...event,
      cursor: `${++this.cursor}`,
    }
    this.events.push(next)
    return next
  }

  async readLifecycleEventsFromCursor(input: {
    scope: Scope
    cursor?: string
    limit: number
    eventTypes?: MemoryEventType[]
  }): Promise<{ events: MemoryEvent[]; nextCursor?: string }> {
    const typeFilter = input.eventTypes?.length ? new Set(input.eventTypes) : undefined
    const scoped = this.events.filter((event) => {
      if (!hasSameScope(event.scope, input.scope)) return false
      if (!typeFilter) return true
      return typeFilter.has(event.type)
    })
    if (!input.cursor) {
      const events = scoped.slice(0, input.limit)
      const nextCursor = events.at(-1)?.cursor
      return nextCursor ? { events, nextCursor } : { events }
    }
    const startIndex = scoped.findIndex((event) => Number(event.cursor) >= Number(input.cursor))
    if (startIndex < 0) {
      return { events: [] }
    }
    const events = scoped.slice(startIndex, startIndex + input.limit)
    const nextCursor = events.at(-1)?.cursor
    return nextCursor ? { events, nextCursor } : { events }
  }

  async isCursorValidForScope(scope: Scope, cursor: string): Promise<boolean> {
    return this.events.some((event) => hasSameScope(event.scope, scope) && event.cursor === cursor)
  }

  async isCursorKnown(cursor: string): Promise<boolean> {
    return this.events.some((event) => event.cursor === cursor)
  }
}
