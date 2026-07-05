import type {
  DurableMemoryObject,
  Episode,
  Link,
  MemoryEvent,
  MemoryFilters,
  MemoryRef,
  Scope,
} from "../types"
import {
  type AdapterCapabilityDescriptor,
  type EpisodeStore,
  type GraphStore,
  type IndexedCandidate,
  type IndexPayload,
  type IndexStore,
  type JobRecord,
  type MetadataStore,
  type ObjectStore,
} from "../ports"
import { matchesScope, refKey, scopeKey } from "../utils"

const isVisibleByFilters = (object: DurableMemoryObject, filters?: MemoryFilters): boolean => {
  if (object.status === "tombstoned" && !filters?.includeTombstoned) return false
  if (object.status === "disputed" && !filters?.includeDisputed) return false
  if (object.status === "superseded" && !filters?.includeSuperseded) return false
  if (filters?.types && !filters.types.includes(object.type)) return false
  return true
}

export class InMemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<string, DurableMemoryObject>()

  async upsert(object: DurableMemoryObject): Promise<void> {
    this.objects.set(refKey({ id: object.id, type: object.type, scope: object.scope }), object)
  }

  async get(ref: MemoryRef): Promise<DurableMemoryObject | null> {
    return this.objects.get(refKey(ref)) ?? null
  }

  async getMany(refs: MemoryRef[]): Promise<DurableMemoryObject[]> {
    return refs
      .map((ref) => this.objects.get(refKey(ref)))
      .filter((value): value is DurableMemoryObject => Boolean(value))
  }

  async list(scope: Scope): Promise<DurableMemoryObject[]> {
    return [...this.objects.values()].filter((object) => matchesScope(object.scope, scope))
  }
}

export class InMemoryEpisodeStore implements EpisodeStore {
  private readonly episodes = new Map<string, Episode>()
  private readonly dedupe = new Map<string, string>()

  async appendEpisode(episode: Episode): Promise<void> {
    const key = refKey({ id: episode.id, type: "episode", scope: episode.scope })
    this.episodes.set(key, episode)
    if (episode.dedupeKey) {
      const dedupeLookup = `${scopeKey(episode.scope)}::${episode.dedupeKey}`
      this.dedupe.set(dedupeLookup, key)
    }
  }

  async getEpisode(ref: MemoryRef): Promise<Episode | null> {
    if (ref.type !== "episode") return null
    return this.episodes.get(refKey(ref)) ?? null
  }

  async getEpisodes(refs: MemoryRef[]): Promise<Episode[]> {
    return refs
      .map((ref) => (ref.type === "episode" ? this.episodes.get(refKey(ref)) : undefined))
      .filter((value): value is Episode => Boolean(value))
  }

  async listEpisodes(scope: Scope): Promise<Episode[]> {
    return [...this.episodes.values()].filter((episode) => matchesScope(episode.scope, scope))
  }

  async resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<Episode | null> {
    const dedupeLookup = `${scopeKey(scope)}::${dedupeKey}`
    const storedKey = this.dedupe.get(dedupeLookup)
    if (!storedKey) return null
    return this.episodes.get(storedKey) ?? null
  }

  async tombstoneEpisode(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found"> {
    if (ref.type !== "episode") return "not_found"
    const key = refKey(ref)
    const current = this.episodes.get(key)
    if (!current) return "not_found"
    if (current.status === "tombstoned") return "already_tombstoned"
    this.episodes.set(key, { ...current, status: "tombstoned" })
    return "tombstoned"
  }
}

export class InMemoryGraphStore implements GraphStore {
  private readonly links = new Map<string, Link>()

  async addLink(link: Link): Promise<void> {
    this.links.set(refKey({ id: link.id, type: "link", scope: link.scope }), link)
  }

  async getOutgoingLinks(ref: MemoryRef): Promise<Link[]> {
    return [...this.links.values()].filter(
      (link) => link.status !== "tombstoned" && refKey(link.from) === refKey(ref),
    )
  }

  async getIncomingLinks(ref: MemoryRef): Promise<Link[]> {
    return [...this.links.values()].filter(
      (link) => link.status !== "tombstoned" && refKey(link.to) === refKey(ref),
    )
  }

  async getProvenanceChain(ref: MemoryRef, maxDepth = 8): Promise<Link[]> {
    const chain: Link[] = []
    let frontier = [ref]

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
      const next: MemoryRef[] = []
      for (const current of frontier) {
        const incoming = await this.getIncomingLinks(current)
        for (const link of incoming) {
          chain.push(link)
          next.push(link.from)
        }
      }
      frontier = next
    }

    return chain
  }

  async listLinks(scope: Scope): Promise<Link[]> {
    return [...this.links.values()].filter((link) => matchesScope(link.scope, scope))
  }

  async tombstoneLink(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found"> {
    if (ref.type !== "link") return "not_found"
    const key = refKey(ref)
    const current = this.links.get(key)
    if (!current) return "not_found"
    if (current.status === "tombstoned") return "already_tombstoned"
    this.links.set(key, { ...current, status: "tombstoned" })
    return "tombstoned"
  }
}

export class InMemoryIndexStore implements IndexStore {
  private readonly indexed = new Map<string, IndexPayload>()

  async indexMemory(payload: IndexPayload): Promise<void> {
    this.indexed.set(refKey(payload.ref), payload)
  }

  async removeIndexed(ref: MemoryRef): Promise<void> {
    this.indexed.delete(refKey(ref))
  }

  async search(scope: Scope, query: string, filters?: MemoryFilters, limit = 20): Promise<IndexedCandidate[]> {
    const normalizedQuery = query.toLowerCase().trim()
    const candidates: IndexedCandidate[] = []

    for (const payload of this.indexed.values()) {
      if (!matchesScope(payload.ref.scope, scope)) continue
      const haystack = payload.text.toLowerCase()
      let score = 0
      if (haystack.includes(normalizedQuery)) {
        score += 1
        score += normalizedQuery.length / Math.max(haystack.length, 1)
      }
      if (score <= 0) continue

      candidates.push({
        ref: payload.ref,
        score,
        reason: "lexical match",
      })
    }

    candidates.sort((a, b) => b.score - a.score)
    const clipped = candidates.slice(0, limit)

    if (!filters) return clipped
    return clipped.filter((candidate) => {
      if (!filters.types) return true
      return filters.types.includes(candidate.ref.type)
    })
  }

  async reportFreshness(): Promise<"fresh" | "stale" | "unknown"> {
    return "fresh"
  }
}

export class InMemoryMetadataStore implements MetadataStore {
  private readonly scopes = new Set<string>()
  private readonly jobs = new Map<string, JobRecord>()
  private readonly events = new Map<string, MemoryEvent[]>()

  async storeScope(scope: Scope): Promise<void> {
    this.scopes.add(scopeKey(scope))
  }

  async hasScope(scope: Scope): Promise<boolean> {
    return this.scopes.has(scopeKey(scope))
  }

  async upsertJob(job: JobRecord): Promise<void> {
    this.jobs.set(`${scopeKey(job.scope)}::${job.jobId}`, job)
  }

  async getJob(scope: Scope, jobId: string): Promise<JobRecord | null> {
    return this.jobs.get(`${scopeKey(scope)}::${jobId}`) ?? null
  }

  async appendEvent(event: MemoryEvent): Promise<void> {
    const key = scopeKey(event.scope)
    const current = this.events.get(key) ?? []
    current.push(event)
    this.events.set(key, current)
  }

  async listEvents(scope: Scope, cursor?: string): Promise<MemoryEvent[]> {
    const events = this.events.get(scopeKey(scope)) ?? []
    if (!cursor) return events
    const cursorIndex = events.findIndex((event) => event.id === cursor)
    if (cursorIndex < 0) return events
    return events.slice(cursorIndex + 1)
  }

  async listQueuedJobs(limit = 32): Promise<JobRecord[]> {
    const queued = [...this.jobs.values()].filter((job) => job.status === "queued")
    queued.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return queued.slice(0, limit)
  }
}

export const inMemoryCapabilities: AdapterCapabilityDescriptor = {
  implementedPorts: ["EpisodeStore", "GraphStore", "IndexStore", "MetadataStore"],
  transactionalGuarantees: ["single-process in-memory best effort"],
  indexConsistency: "synchronous",
  paginationBehavior: "none",
  supportedFilters: ["allowedTypes"],
}

export const isVisibleForRead = isVisibleByFilters
