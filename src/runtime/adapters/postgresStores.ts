import type { DurableMemoryObject, Episode, Link, MemoryEvent, MemoryFilters, MemoryRef, Scope } from "../types"
import type {
  EpisodeStore,
  GraphStore,
  IndexedCandidate,
  IndexPayload,
  IndexStore,
  JobRecord,
  MetadataStore,
  ObjectStore,
} from "../ports"
import { matchesScope, refKey, scopeKey } from "../utils"
import { isVisibleForRead } from "./inMemoryStores"

type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>
}

const parsePayload = <T>(value: unknown): T => {
  if (typeof value === "string") return JSON.parse(value) as T
  return value as T
}

export const postgresSchemaSql = `
CREATE TABLE IF NOT EXISTS infinicon_objects (
  ref_key TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL,
  object_type TEXT NOT NULL,
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS infinicon_objects_scope_idx ON infinicon_objects(scope_key);
CREATE TABLE IF NOT EXISTS infinicon_jobs (
  job_key TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL,
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS infinicon_jobs_status_idx ON infinicon_jobs((payload->>'status'));
CREATE TABLE IF NOT EXISTS infinicon_events (
  id BIGSERIAL PRIMARY KEY,
  scope_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS infinicon_events_scope_idx ON infinicon_events(scope_key, id);
CREATE TABLE IF NOT EXISTS infinicon_index (
  ref_key TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL,
  search_text TEXT NOT NULL,
  payload JSONB NOT NULL
);
`

export const initPostgresSchema = async (sql: SqlClient): Promise<void> => {
  await sql`
    CREATE TABLE IF NOT EXISTS infinicon_objects (
      ref_key TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL,
      object_type TEXT NOT NULL,
      payload JSONB NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS infinicon_objects_scope_idx ON infinicon_objects(scope_key)`
  await sql`
    CREATE TABLE IF NOT EXISTS infinicon_jobs (
      job_key TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL,
      payload JSONB NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS infinicon_jobs_status_idx ON infinicon_jobs((payload->>'status'))`
  await sql`
    CREATE TABLE IF NOT EXISTS infinicon_events (
      id BIGSERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL,
      event_id TEXT NOT NULL,
      payload JSONB NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS infinicon_events_scope_idx ON infinicon_events(scope_key, id)`
  await sql`
    CREATE TABLE IF NOT EXISTS infinicon_index (
      ref_key TEXT PRIMARY KEY,
      scope_key TEXT NOT NULL,
      search_text TEXT NOT NULL,
      payload JSONB NOT NULL
    )
  `
}

export class PostgresObjectStore implements ObjectStore {
  constructor(private readonly sql: SqlClient) {}

  async upsert(object: DurableMemoryObject): Promise<void> {
    const key = refKey({ id: object.id, type: object.type, scope: object.scope })
    await this.sql`
      INSERT INTO infinicon_objects (ref_key, scope_key, object_type, payload)
      VALUES (${key}, ${scopeKey(object.scope)}, ${object.type}, ${JSON.stringify(object)})
      ON CONFLICT (ref_key) DO UPDATE SET payload = EXCLUDED.payload
    `
  }

  async get(ref: MemoryRef): Promise<DurableMemoryObject | null> {
    const rows = (await this.sql`
      SELECT payload FROM infinicon_objects WHERE ref_key = ${refKey(ref)} LIMIT 1
    `) as Array<{ payload: unknown }>
    return rows[0] ? parsePayload<DurableMemoryObject>(rows[0].payload) : null
  }

  async getMany(refs: MemoryRef[]): Promise<DurableMemoryObject[]> {
    const objects: DurableMemoryObject[] = []
    for (const ref of refs) {
      const object = await this.get(ref)
      if (object) objects.push(object)
    }
    return objects
  }

  async list(scope: Scope): Promise<DurableMemoryObject[]> {
    const rows = (await this.sql`
      SELECT payload FROM infinicon_objects WHERE scope_key = ${scopeKey(scope)}
    `) as Array<{ payload: unknown }>
    return rows.map((row) => parsePayload<DurableMemoryObject>(row.payload)).filter((object) => matchesScope(object.scope, scope))
  }
}

export class PostgresEpisodeStore implements EpisodeStore {
  constructor(private readonly objectStore: PostgresObjectStore) {}

  async appendEpisode(episode: Episode): Promise<void> {
    await this.objectStore.upsert(episode)
  }

  async getEpisode(ref: MemoryRef): Promise<Episode | null> {
    const object = await this.objectStore.get(ref)
    return object?.type === "episode" ? object : null
  }

  async getEpisodes(refs: MemoryRef[]): Promise<Episode[]> {
    return (await this.objectStore.getMany(refs)).filter((object): object is Episode => object.type === "episode")
  }

  async listEpisodes(scope: Scope): Promise<Episode[]> {
    return (await this.objectStore.list(scope)).filter((object): object is Episode => object.type === "episode")
  }

  async resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<Episode | null> {
    const episodes = await this.listEpisodes(scope)
    return episodes.find((episode) => episode.dedupeKey === dedupeKey) ?? null
  }

  async tombstoneEpisode(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found"> {
    const episode = await this.getEpisode(ref)
    if (!episode) return "not_found"
    if (episode.status === "tombstoned") return "already_tombstoned"
    await this.objectStore.upsert({ ...episode, status: "tombstoned" })
    return "tombstoned"
  }
}

export class PostgresGraphStore implements GraphStore {
  constructor(private readonly objectStore: PostgresObjectStore) {}

  async addLink(link: Link): Promise<void> {
    await this.objectStore.upsert(link)
  }

  async getOutgoingLinks(ref: MemoryRef): Promise<Link[]> {
    const links = await this.listLinks(ref.scope)
    return links.filter((link) => link.status !== "tombstoned" && refKey(link.from) === refKey(ref))
  }

  async getIncomingLinks(ref: MemoryRef): Promise<Link[]> {
    const links = await this.listLinks(ref.scope)
    return links.filter((link) => link.status !== "tombstoned" && refKey(link.to) === refKey(ref))
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
    return (await this.objectStore.list(scope)).filter((object): object is Link => object.type === "link")
  }

  async tombstoneLink(ref: MemoryRef): Promise<"tombstoned" | "already_tombstoned" | "not_found"> {
    const link = await this.objectStore.get(ref)
    if (!link || link.type !== "link") return "not_found"
    if (link.status === "tombstoned") return "already_tombstoned"
    await this.objectStore.upsert({ ...link, status: "tombstoned" })
    return "tombstoned"
  }
}

export class PostgresIndexStore implements IndexStore {
  constructor(private readonly sql: SqlClient, private readonly objectStore: PostgresObjectStore) {}

  async indexMemory(payload: IndexPayload): Promise<void> {
    await this.sql`
      INSERT INTO infinicon_index (ref_key, scope_key, search_text, payload)
      VALUES (${refKey(payload.ref)}, ${scopeKey(payload.ref.scope)}, ${payload.text}, ${JSON.stringify(payload)})
      ON CONFLICT (ref_key) DO UPDATE SET search_text = EXCLUDED.search_text, payload = EXCLUDED.payload
    `
  }

  async removeIndexed(ref: MemoryRef): Promise<void> {
    await this.sql`DELETE FROM infinicon_index WHERE ref_key = ${refKey(ref)}`
  }

  async search(scope: Scope, query: string, filters?: MemoryFilters, limit = 20): Promise<IndexedCandidate[]> {
    const normalizedQuery = query.toLowerCase().trim()
    const rows = (await this.sql`
      SELECT payload FROM infinicon_index WHERE scope_key = ${scopeKey(scope)}
    `) as Array<{ payload: unknown }>

    const candidates: IndexedCandidate[] = []
    for (const row of rows) {
      const payload = parsePayload<IndexPayload>(row.payload)
      const object = await this.objectStore.get(payload.ref)
      if (!object || !isVisibleForRead(object, filters)) continue

      const haystack = payload.text.toLowerCase()
      let score = 0
      if (haystack.includes(normalizedQuery)) {
        score += 1
        score += normalizedQuery.length / Math.max(haystack.length, 1)
      }
      if (score <= 0) continue
      candidates.push({ ref: payload.ref, score, reason: "postgres lexical match" })
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  async reportFreshness(): Promise<"fresh" | "stale" | "unknown"> {
    return "stale"
  }
}

export class PostgresMetadataStore implements MetadataStore {
  constructor(private readonly sql: SqlClient) {}

  async storeScope(scope: Scope): Promise<void> {
    await this.sql`
      INSERT INTO infinicon_objects (ref_key, scope_key, object_type, payload)
      VALUES (${`scope:${scopeKey(scope)}`}, ${scopeKey(scope)}, 'scope', ${JSON.stringify(scope)})
      ON CONFLICT (ref_key) DO NOTHING
    `
  }

  async hasScope(scope: Scope): Promise<boolean> {
    const rows = (await this.sql`
      SELECT 1 FROM infinicon_objects WHERE ref_key = ${`scope:${scopeKey(scope)}`} LIMIT 1
    `) as unknown[]
    return rows.length > 0
  }

  async upsertJob(job: JobRecord): Promise<void> {
    await this.sql`
      INSERT INTO infinicon_jobs (job_key, scope_key, payload)
      VALUES (${`${scopeKey(job.scope)}::${job.jobId}`}, ${scopeKey(job.scope)}, ${JSON.stringify(job)})
      ON CONFLICT (job_key) DO UPDATE SET payload = EXCLUDED.payload
    `
  }

  async getJob(scope: Scope, jobId: string): Promise<JobRecord | null> {
    const rows = (await this.sql`
      SELECT payload FROM infinicon_jobs WHERE job_key = ${`${scopeKey(scope)}::${jobId}`} LIMIT 1
    `) as Array<{ payload: unknown }>
    return rows[0] ? parsePayload<JobRecord>(rows[0].payload) : null
  }

  async appendEvent(event: MemoryEvent): Promise<void> {
    await this.sql`
      INSERT INTO infinicon_events (scope_key, event_id, payload)
      VALUES (${scopeKey(event.scope)}, ${event.id}, ${JSON.stringify(event)})
    `
  }

  async listEvents(scope: Scope, cursor?: string): Promise<MemoryEvent[]> {
    const rows = cursor
      ? ((await this.sql`
          SELECT payload FROM infinicon_events
          WHERE scope_key = ${scopeKey(scope)} AND id > (SELECT id FROM infinicon_events WHERE event_id = ${cursor} LIMIT 1)
          ORDER BY id ASC
        `) as Array<{ payload: unknown }>)
      : ((await this.sql`
          SELECT payload FROM infinicon_events WHERE scope_key = ${scopeKey(scope)} ORDER BY id ASC
        `) as Array<{ payload: unknown }>)
    return rows.map((row) => parsePayload<MemoryEvent>(row.payload))
  }

  async listQueuedJobs(limit = 32): Promise<JobRecord[]> {
    const rows = (await this.sql`
      SELECT payload FROM infinicon_jobs
      WHERE payload->>'status' = 'queued'
      ORDER BY payload->>'createdAt' ASC
      LIMIT ${limit}
    `) as Array<{ payload: unknown }>
    return rows.map((row) => parsePayload<JobRecord>(row.payload))
  }
}

export type PostgresStores = {
  objectStore: PostgresObjectStore
  episodeStore: PostgresEpisodeStore
  graphStore: PostgresGraphStore
  indexStore: PostgresIndexStore
  metadataStore: PostgresMetadataStore
}

export const createPostgresStores = (connectionString: string): PostgresStores => {
  const sql = (globalThis as { Bun?: { sql: SqlClient } }).Bun?.sql
  if (!sql) throw new Error("Bun.sql is required for postgres adapters")

  void connectionString
  const objectStore = new PostgresObjectStore(sql)
  return {
    objectStore,
    episodeStore: new PostgresEpisodeStore(objectStore),
    graphStore: new PostgresGraphStore(objectStore),
    indexStore: new PostgresIndexStore(sql, objectStore),
    metadataStore: new PostgresMetadataStore(sql),
  }
}
