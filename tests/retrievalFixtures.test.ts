import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
  MemoryRuntimeService,
  createDefaultPluginHost,
  createRuntimeDeps,
} from "../src/runtime"

type RetrievalFixture = {
  name: string
  scope: { tenantId: string; namespaceId: string; agentId?: string }
  episodes: Array<{ contentType: string; content: string }>
  query: string
  expectMinRefs: number
  expectMatchTokens: string[]
}

const fixturePath = join(import.meta.dir, "fixtures/retrieval/basic-ranking.json")
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as RetrievalFixture

describe("retrieval fixtures", () => {
  test(`${fixture.name} ranks relevant memory`, async () => {
    const bootstrap = createDefaultPluginHost()
    const runtime = new MemoryRuntimeService(
      createRuntimeDeps(
        {
          episodeStore: new InMemoryEpisodeStore(),
          graphStore: new InMemoryGraphStore(),
          indexStore: new InMemoryIndexStore(),
          metadataStore: new InMemoryMetadataStore(),
          objectStore: new InMemoryObjectStore(),
        },
        bootstrap,
      ),
    )

    await runtime.ingest({
      scope: fixture.scope,
      episodes: fixture.episodes.map((episode) => ({
        ...episode,
        createdBy: { id: "fixture", kind: "system" },
      })),
    })

    const result = await runtime.query({ scope: fixture.scope, query: fixture.query })
    expect(result.refs.length).toBeGreaterThanOrEqual(fixture.expectMinRefs)

    const hydrated = await runtime.hydrate({ scope: fixture.scope, refs: result.refs.map((row) => row.ref) })
    const haystack = hydrated.objects
      .map((object) => (typeof object.content === "string" ? object.content : JSON.stringify(object.content)))
      .join(" ")
      .toLowerCase()
    for (const token of fixture.expectMatchTokens) {
      expect(haystack).toContain(token)
    }
  })
})
