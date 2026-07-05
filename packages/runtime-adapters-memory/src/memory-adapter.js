import { scopeKey } from "../../runtime-types/src/memory-types.js"
import {
  EpisodeStore,
  GraphStore,
  IndexStore,
  MetadataStore,
} from "../../runtime-core/src/ports.js"

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function overlaps(a, b) {
  if (a.size === 0) {
    return true
  }
  for (const token of b) {
    if (a.has(token)) {
      return true
    }
  }
  return false
}

export class InMemoryEpisodeStore extends EpisodeStore {
  constructor() {
    super()
    this.episodes = new Map()
    this.dedupeByScope = new Map()
  }

  async appendEpisode(episode) {
    this.episodes.set(episode.id, episode)
    if (episode.dedupeKey) {
      this.dedupeByScope.set(`${scopeKey(episode.scope)}:${episode.dedupeKey}`, episode.id)
    }
    return episode
  }

  async getEpisodeByRef(ref) {
    return this.episodes.get(ref.id) ?? null
  }

  async getEpisodesByRefs(refs) {
    return refs.map((ref) => this.episodes.get(ref.id)).filter(Boolean)
  }

  async resolveDedupeKey(scope, dedupeKey) {
    if (!dedupeKey) {
      return null
    }
    const existingId = this.dedupeByScope.get(`${scopeKey(scope)}:${dedupeKey}`)
    if (!existingId) {
      return null
    }
    return this.episodes.get(existingId) ?? null
  }

  async tombstoneEpisode(ref, reason) {
    const existing = this.episodes.get(ref.id)
    if (!existing) {
      return null
    }
    const next = {
      ...existing,
      status: "tombstoned",
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(existing.metadata ?? {}),
        tombstoneReason: reason,
      },
    }
    this.episodes.set(ref.id, next)
    return next
  }
}

export class InMemoryGraphStore extends GraphStore {
  constructor() {
    super()
    this.links = new Map()
  }

  async addLink(link) {
    this.links.set(link.id, link)
    return link
  }

  async getOutgoingLinks(ref) {
    return Array.from(this.links.values()).filter(
      (link) => link.from?.id === ref.id && link.status !== "tombstoned",
    )
  }

  async getIncomingLinks(ref) {
    return Array.from(this.links.values()).filter(
      (link) => link.to?.id === ref.id && link.status !== "tombstoned",
    )
  }

  async getProvenanceChain(ref) {
    return Array.from(this.links.values()).filter(
      (link) =>
        (link.from?.id === ref.id || link.to?.id === ref.id) && link.status !== "tombstoned",
    )
  }

  async tombstoneLink(ref) {
    const existing = this.links.get(ref.id)
    if (!existing) {
      return null
    }
    const next = {
      ...existing,
      status: "tombstoned",
      updatedAt: new Date().toISOString(),
    }
    this.links.set(ref.id, next)
    return next
  }
}

export class InMemoryIndexStore extends IndexStore {
  constructor() {
    super()
    this.entries = new Map()
    this.lastIndexedAt = null
  }

  async indexMemoryPayload(payload) {
    this.entries.set(payload.ref.id, {
      ...payload,
      tokens: tokenize(payload.text),
    })
    this.lastIndexedAt = new Date().toISOString()
    return true
  }

  async removeOrHidePayload(ref) {
    const existing = this.entries.get(ref.id)
    if (!existing) {
      return false
    }
    this.entries.set(ref.id, {
      ...existing,
      hidden: true,
    })
    return true
  }

  async searchByQueryPayload(scope, query, filters = {}, limit = 20) {
    const queryTokens = new Set(tokenize(query))
    const items = Array.from(this.entries.values())
      .filter((entry) => entry.scope.tenantId === scope.tenantId)
      .filter((entry) => entry.scope.namespaceId === scope.namespaceId)
      .filter((entry) => !entry.hidden)
      .filter((entry) => entry.status !== "tombstoned")
      .filter((entry) => {
        if (filters?.types?.length && !filters.types.includes(entry.ref.type)) {
          return false
        }
        if (!filters?.includeDisputed && entry.status === "disputed") {
          return false
        }
        if (!filters?.includeSuperseded && entry.status === "superseded") {
          return false
        }
        return true
      })
      .filter((entry) => overlaps(queryTokens, new Set(entry.tokens)))
      .map((entry) => {
        const overlapCount = entry.tokens.filter((token) => queryTokens.has(token)).length
        return {
          ref: entry.ref,
          score: queryTokens.size === 0 ? 0 : overlapCount / queryTokens.size,
          reason: "token_overlap",
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return items
  }

  async searchByFilters(scope, filters = {}, limit = 20) {
    const items = Array.from(this.entries.values())
      .filter((entry) => entry.scope.tenantId === scope.tenantId)
      .filter((entry) => entry.scope.namespaceId === scope.namespaceId)
      .filter((entry) => !entry.hidden)
      .filter((entry) => entry.status !== "tombstoned")
      .filter((entry) => {
        if (filters?.types?.length && !filters.types.includes(entry.ref.type)) {
          return false
        }
        return true
      })
      .slice(0, limit)
      .map((entry) => ({ ref: entry.ref, score: 0, reason: "filter_match" }))

    return items
  }

  async getIndexFreshness() {
    return {
      indexedAt: this.lastIndexedAt,
      consistency: "eventual",
    }
  }
}

export class InMemoryMetadataStore extends MetadataStore {
  constructor() {
    super()
    this.scopes = new Map()
    this.jobs = new Map()
    this.pluginState = new Map()
    this.cursors = new Map()
    this.events = new Map()
  }

  async upsertScope(scope) {
    this.scopes.set(scopeKey(scope), scope)
    return scope
  }

  async saveJob(job) {
    this.jobs.set(`${scopeKey(job.scope)}:${job.jobId}`, job)
    return job
  }

  async getJob(scope, jobId) {
    return this.jobs.get(`${scopeKey(scope)}:${jobId}`) ?? null
  }

  async savePluginState(pluginName, state) {
    this.pluginState.set(pluginName, state)
    return true
  }

  async saveEventCursor(scope, cursor) {
    this.cursors.set(scopeKey(scope), cursor)
    return true
  }

  async appendEvent(scope, event) {
    const key = scopeKey(scope)
    const existing = this.events.get(key) ?? []
    const next = [...existing, event]
    this.events.set(key, next)
    return event
  }

  async getEventsSince(scope, cursor, eventTypes = null) {
    const key = scopeKey(scope)
    const events = this.events.get(key) ?? []
    const sinceIndex = cursor ? events.findIndex((event) => event.cursor === cursor) : -1
    const sliceStart = sinceIndex < 0 ? 0 : sinceIndex + 1
    const filtered = events
      .slice(sliceStart)
      .filter((event) => !Array.isArray(eventTypes) || eventTypes.length === 0 || eventTypes.includes(event.type))
    return filtered
  }
}

export function createInMemoryAdapter() {
  return {
    episodeStore: new InMemoryEpisodeStore(),
    graphStore: new InMemoryGraphStore(),
    indexStore: new InMemoryIndexStore(),
    metadataStore: new InMemoryMetadataStore(),
  }
}
