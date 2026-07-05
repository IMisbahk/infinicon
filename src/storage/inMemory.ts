import type { DurableMemoryObject, MemoryRef, Scope } from "../domain/types"
import type { EpisodeStore, GraphLink, GraphStore, IndexItem, IndexStore, JobRecord, MetadataStore, StoragePorts } from "./ports"

const scopeKey = (scope: Scope) => `${scope.tenantId}:${scope.namespaceId}`
const refKey = (ref: MemoryRef) => `${scopeKey(ref.scope)}:${ref.type}:${ref.id}`

const ensureScopeMatch = (a: Scope, b: Scope): boolean => {
  return a.tenantId === b.tenantId && a.namespaceId === b.namespaceId
}

const normalizeText = (value: unknown): string => {
  if (typeof value === "string") {
    return value.toLowerCase()
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value).toLowerCase()
  }
  return String(value ?? "").toLowerCase()
}

export const createInMemoryEpisodeStore = (): EpisodeStore => {
  const byRef = new Map<string, DurableMemoryObject & { dedupeKey?: string }>()
  const byDedupe = new Map<string, string>()

  return {
    append: async (object) => {
      const key = refKey({ id: object.id, type: "episode", scope: object.scope })
      byRef.set(key, object)
      if (object.dedupeKey) {
        byDedupe.set(`${scopeKey(object.scope)}:${object.dedupeKey}`, key)
      }
    },

    findByRef: async (scope, ref) => {
      if (!ensureScopeMatch(scope, ref.scope)) {
        return null
      }
      const object = byRef.get(refKey(ref))
      if (!object || object.status === "tombstoned") {
        return null
      }
      return object
    },

    findByRefs: async (scope, refs) => {
      const objects: DurableMemoryObject[] = []
      for (const ref of refs) {
        if (!ensureScopeMatch(scope, ref.scope)) {
          continue
        }
        const object = byRef.get(refKey(ref))
        if (object && object.status !== "tombstoned") {
          objects.push(object)
        }
      }
      return objects
    },

    findByDedupeKey: async (scope, dedupeKey) => {
      const key = byDedupe.get(`${scopeKey(scope)}:${dedupeKey}`)
      if (!key) {
        return null
      }
      const object = byRef.get(key)
      if (!object || object.status === "tombstoned") {
        return null
      }
      return object
    },

    tombstone: async (scope, ref) => {
      if (!ensureScopeMatch(scope, ref.scope)) {
        return false
      }
      const key = refKey(ref)
      const object = byRef.get(key)
      if (!object || object.status === "tombstoned") {
        return false
      }
      byRef.set(key, { ...object, status: "tombstoned", metadata: { ...object.metadata, tombstonedAt: new Date().toISOString() } })
      return true
    },

    listByScope: async (scope) => {
      const list: DurableMemoryObject[] = []
      for (const object of byRef.values()) {
        if (ensureScopeMatch(scope, object.scope) && object.status !== "tombstoned") {
          list.push(object)
        }
      }
      return list
    },
  }
}

export const createInMemoryGraphStore = (): GraphStore => {
  const links = new Map<string, GraphLink>()

  return {
    addLink: async (link) => {
      links.set(`${scopeKey(link.scope)}:${link.id}`, link)
    },

    getOutgoing: async (scope, from) => {
      const out: GraphLink[] = []
      for (const link of links.values()) {
        if (!ensureScopeMatch(scope, link.scope) || link.status === "tombstoned") {
          continue
        }
        if (link.from.id === from.id && link.from.type === from.type) {
          out.push(link)
        }
      }
      return out
    },

    getIncoming: async (scope, to) => {
      const incoming: GraphLink[] = []
      for (const link of links.values()) {
        if (!ensureScopeMatch(scope, link.scope) || link.status === "tombstoned") {
          continue
        }
        if (link.to.id === to.id && link.to.type === to.type) {
          incoming.push(link)
        }
      }
      return incoming
    },

    tombstoneLink: async (scope, linkId) => {
      const key = `${scopeKey(scope)}:${linkId}`
      const link = links.get(key)
      if (!link || link.status === "tombstoned") {
        return false
      }
      links.set(key, { ...link, status: "tombstoned" })
      return true
    },
  }
}

export const createInMemoryIndexStore = (): IndexStore => {
  const index = new Map<string, IndexItem>()

  return {
    index: async (_scope, item) => {
      index.set(refKey(item.ref), item)
    },

    remove: async (_scope, ref) => {
      const key = refKey(ref)
      const existing = index.get(key)
      if (!existing) {
        return
      }
      index.set(key, { ...existing, status: "tombstoned", updatedAt: new Date().toISOString() })
    },

    search: async (scope, query, limit) => {
      const queryText = query.toLowerCase()
      const scored: { ref: MemoryRef; score: number }[] = []

      for (const item of index.values()) {
        if (!ensureScopeMatch(scope, item.ref.scope) || item.status === "tombstoned") {
          continue
        }

        const haystack = normalizeText(item.text)
        if (!haystack.includes(queryText)) {
          continue
        }

        const score = queryText.length / Math.max(haystack.length, 1)
        scored.push({ ref: item.ref, score })
      }

      return scored.sort((a, b) => b.score - a.score).slice(0, limit)
    },
  }
}

export const createInMemoryMetadataStore = (): MetadataStore => {
  const jobs = new Map<string, JobRecord>()

  return {
    putJob: async (job) => {
      jobs.set(`${scopeKey(job.scope)}:${job.jobId}`, job)
    },

    getJob: async (scope, jobId) => {
      return jobs.get(`${scopeKey(scope)}:${jobId}`) ?? null
    },
  }
}

export const createInMemoryStoragePorts = (): StoragePorts => {
  return {
    episodes: createInMemoryEpisodeStore(),
    graph: createInMemoryGraphStore(),
    index: createInMemoryIndexStore(),
    metadata: createInMemoryMetadataStore(),
  }
}
