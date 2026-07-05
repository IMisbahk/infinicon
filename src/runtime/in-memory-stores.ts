import type {
  EpisodeStore,
  EpisodeObject,
  GraphStore,
  IndexRecord,
  IndexStore,
  LinkObject,
  MetadataStore,
  QueryCandidate,
} from "./ports"
import type { DurableMemoryObject, GetJobResponse, MemoryRef, Scope } from "./types"
import { nowIso, refKey, sameTenantNamespace, strictScopeKey } from "./utils"

export class InMemoryEpisodeStore implements EpisodeStore {
  private byRef = new Map<string, EpisodeObject>()
  private dedupe = new Map<string, string>()

  async appendEpisode(episode: EpisodeObject): Promise<void> {
    const key = refKey({ id: episode.id, type: "episode", scope: episode.scope })
    this.byRef.set(key, episode)
    this.dedupe.set(`${strictScopeKey(episode.scope)}::${episode.dedupeKey}`, key)
  }

  async getByRef(ref: MemoryRef): Promise<EpisodeObject | null> {
    if (ref.type !== "episode") return null
    return this.byRef.get(refKey(ref)) ?? null
  }

  async getByRefs(refs: MemoryRef[]): Promise<(EpisodeObject | null)[]> {
    return Promise.all(refs.map(ref => this.getByRef(ref)))
  }

  async resolveByDedupeKey(scope: Scope, dedupeKey: string): Promise<EpisodeObject | null> {
    const key = this.dedupe.get(`${strictScopeKey(scope)}::${dedupeKey}`)
    if (!key) return null
    return this.byRef.get(key) ?? null
  }

  async tombstone(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found"> {
    const existing = await this.getByRef(ref)
    if (!existing) return "not_found"
    if (existing.status === "tombstoned") return "already_tombstoned"
    existing.status = "tombstoned"
    existing.updatedAt = nowIso()
    return "tombstoned"
  }

  async listActive(scope: Scope): Promise<EpisodeObject[]> {
    const result: EpisodeObject[] = []
    for (const episode of this.byRef.values()) {
      if (!sameTenantNamespace(episode.scope, scope)) continue
      if (episode.status !== "active" && episode.status !== "pending") continue
      result.push(episode)
    }
    return result
  }
}

export class InMemoryGraphStore implements GraphStore {
  private byRef = new Map<string, LinkObject>()

  async addLink(link: LinkObject): Promise<void> {
    const key = refKey({ id: link.id, type: "link", scope: link.scope })
    this.byRef.set(key, link)
  }

  async outgoing(ref: MemoryRef): Promise<LinkObject[]> {
    return [...this.byRef.values()].filter(link => link.status !== "tombstoned" && refKey(link.from) === refKey(ref))
  }

  async incoming(ref: MemoryRef): Promise<LinkObject[]> {
    return [...this.byRef.values()].filter(link => link.status !== "tombstoned" && refKey(link.to) === refKey(ref))
  }

  async tombstoneLink(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found"> {
    if (ref.type !== "link") return "not_found"
    const key = refKey(ref)
    const existing = this.byRef.get(key)
    if (!existing) return "not_found"
    if (existing.status === "tombstoned") return "already_tombstoned"
    existing.status = "tombstoned"
    existing.updatedAt = nowIso()
    return "tombstoned"
  }
}

export class InMemoryIndexStore implements IndexStore {
  private records = new Map<string, IndexRecord>()

  async index(record: IndexRecord): Promise<void> {
    this.records.set(refKey(record.ref), record)
  }

  async remove(ref: MemoryRef): Promise<void> {
    this.records.delete(refKey(ref))
  }

  async search(scope: Scope, query: string, limit: number): Promise<QueryCandidate[]> {
    const q = query.toLowerCase().trim()
    const results: QueryCandidate[] = []

    for (const record of this.records.values()) {
      if (!sameTenantNamespace(record.ref.scope, scope)) continue
      const text = record.searchableText.toLowerCase()
      if (!q) continue
      if (!text.includes(q) && !q.split(/\s+/).every(token => text.includes(token))) continue
      const score = q.length / Math.max(q.length, text.length)
      results.push({ ref: record.ref, score, reason: "text match" })
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }
}

export class InMemoryMetadataStore implements MetadataStore {
  private objects = new Map<string, DurableMemoryObject>()
  private jobs = new Map<string, GetJobResponse>()
  private cursors = new Map<string, number>()

  async putObject(object: DurableMemoryObject): Promise<void> {
    const key = refKey({ id: object.id, type: object.type, scope: object.scope })
    this.objects.set(key, object)
  }

  async getObject(ref: MemoryRef): Promise<DurableMemoryObject | null> {
    return this.objects.get(refKey(ref)) ?? null
  }

  async getObjects(refs: MemoryRef[]): Promise<(DurableMemoryObject | null)[]> {
    return refs.map(ref => this.objects.get(refKey(ref)) ?? null)
  }

  async listObjectsByScope(scope: Scope): Promise<DurableMemoryObject[]> {
    const out: DurableMemoryObject[] = []
    for (const object of this.objects.values()) {
      if (!sameTenantNamespace(object.scope, scope)) continue
      out.push(object)
    }
    return out
  }

  async updateStatus(ref: MemoryRef, status: DurableMemoryObject["status"]): Promise<"updated" | "not_found" | "unchanged"> {
    const current = this.objects.get(refKey(ref))
    if (!current) return "not_found"
    if (current.status === status) return "unchanged"
    current.status = status
    current.updatedAt = nowIso()
    return "updated"
  }

  async createJob(job: Omit<GetJobResponse, "createdAt" | "updatedAt">): Promise<GetJobResponse> {
    const now = nowIso()
    const created: GetJobResponse = { ...job, createdAt: now, updatedAt: now }
    this.jobs.set(job.jobId, created)
    return created
  }

  async updateJob(jobId: string, updater: (job: GetJobResponse) => GetJobResponse): Promise<GetJobResponse | null> {
    const current = this.jobs.get(jobId)
    if (!current) return null
    const next = updater(current)
    next.updatedAt = nowIso()
    this.jobs.set(jobId, next)
    return next
  }

  async getJob(scope: Scope, jobId: string): Promise<GetJobResponse | null> {
    const job = this.jobs.get(jobId)
    if (!job) return null
    const jobScope = (job.result as { scope?: Scope } | undefined)?.scope
    if (jobScope && !sameTenantNamespace(jobScope, scope)) return null
    return job
  }

  async nextCursor(scope: Scope, kind: "episode" | "atom" | "consolidation" | "link" | "job" | "event"): Promise<string> {
    const key = `${strictScopeKey(scope)}::${kind}`
    const next = (this.cursors.get(key) ?? 0) + 1
    this.cursors.set(key, next)
    return `${kind}_${next}`
  }
}
