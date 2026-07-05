import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
} from "./adapters/inMemoryStores"
import { createPostgresStores, initPostgresSchema } from "./adapters/postgresStores"
import type {
  EpisodeStore,
  GraphStore,
  IndexStore,
  MetadataStore,
  ObjectStore,
} from "../ports"

export type RuntimeStores = {
  episodeStore: EpisodeStore
  graphStore: GraphStore
  indexStore: IndexStore
  metadataStore: MetadataStore
  objectStore: ObjectStore
}

export const createRuntimeStores = async (): Promise<RuntimeStores> => {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    return {
      episodeStore: new InMemoryEpisodeStore(),
      graphStore: new InMemoryGraphStore(),
      indexStore: new InMemoryIndexStore(),
      metadataStore: new InMemoryMetadataStore(),
      objectStore: new InMemoryObjectStore(),
    }
  }

  const sql = (globalThis as { Bun?: { sql: SqlClient } }).Bun?.sql
  if (!sql) throw new Error("DATABASE_URL is set but Bun.sql is unavailable")

  await initPostgresSchema(sql)
  const stores = createPostgresStores(databaseUrl)
  return stores
}

type SqlClient = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>
}
