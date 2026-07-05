import { describe, expect, test } from "bun:test"
import { createRuntime } from "../src/transport/httpServer"

const scope = { tenantId: "tenant-a", namespaceId: "ns-a" }

describe("MemoryRuntimeService via createRuntime", () => {
  test("supports ingest and query", async () => {
    const runtime = createRuntime()

    const ingested = await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "application/json",
          content: { text: "hello" },
          dedupeKey: "k1",
          createdBy: { id: "agent-1", type: "agent" },
        },
      ],
    })

    expect(ingested.results[0]?.status).toBe("created")

    const query = await runtime.query({ scope, query: "hello", limit: 5 })
    expect(query.refs.length).toBe(1)
  })
})

describe("in-memory storage adapters", () => {
  test("episode store resolves dedupe keys and tombstones", async () => {
    const episodeStore = new (await import("../src/runtime")).InMemoryEpisodeStore()
    const ep = {
      id: "ep_1",
      type: "episode" as const,
      scope,
      createdAt: new Date().toISOString(),
      createdBy: { id: "agent-1", type: "agent" as const },
      status: "active" as const,
      metadata: {},
      contentType: "text/plain",
      content: "hello",
      dedupeKey: "k1",
    }

    await episodeStore.appendEpisode(ep)
    const dedupeHit = await episodeStore.resolveDedupeKey(scope, "k1")
    expect(dedupeHit?.id).toBe("ep_1")

    const tombstoned = await episodeStore.tombstoneEpisode({
      id: "ep_1",
      type: "episode",
      scope,
    })
    expect(tombstoned).toBe("tombstoned")

    const missingAfterTombstone = await episodeStore.getEpisode({
      id: "ep_1",
      type: "episode",
      scope,
    })
    expect(missingAfterTombstone?.status).toBe("tombstoned")
  })

  test("index store supports search and remove", async () => {
    const { InMemoryIndexStore } = await import("../src/runtime")
    const store = new InMemoryIndexStore()
    const ref = { id: "ep_2", type: "episode" as const, scope }

    await store.indexMemory({ ref, text: "rust build flags and bun runtime" })

    const beforeRemove = await store.search(scope, "rust", undefined, 5)
    expect(beforeRemove.length).toBe(1)

    await store.removeIndexed(ref)
    const afterRemove = await store.search(scope, "rust", undefined, 5)
    expect(afterRemove.length).toBe(0)
  })
})
