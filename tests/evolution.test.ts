import { describe, expect, test } from "bun:test"
import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
  MemoryRuntimeService,
  createDefaultPluginHost,
  createRuntimeDeps,
  type Link,
} from "../src/runtime"

const scope = { tenantId: "evo", namespaceId: "test" }

const createBootstrappedRuntime = () => {
  const objectStore = new InMemoryObjectStore()
  const bootstrap = createDefaultPluginHost()
  const runtime = new MemoryRuntimeService(
    createRuntimeDeps(
      {
        episodeStore: new InMemoryEpisodeStore(),
        graphStore: new InMemoryGraphStore(),
        indexStore: new InMemoryIndexStore(),
        metadataStore: new InMemoryMetadataStore(),
        objectStore,
      },
      bootstrap,
    ),
  )
  return { runtime, objectStore }
}

describe("evolution pipeline", () => {
  test("consolidation supersedes source episodes", async () => {
    const { runtime, objectStore } = createBootstrappedRuntime()

    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "old fact one",
          createdBy: { id: "agent", kind: "agent" },
        },
        {
          contentType: "text/plain",
          content: "old fact two",
          createdBy: { id: "agent", kind: "agent" },
        },
      ],
    })

    const result = await runtime.consolidate({ scope, trigger: "manual", mode: "run_now" })
    expect(result.status).toBe("completed")

    const query = await runtime.query({ scope, query: "old fact" })
    const episodeRefs = query.refs.filter((row) => row.ref.type === "episode")
    expect(episodeRefs.length).toBe(0)

    const objects = await objectStore.list(scope)
    expect(objects.some((object) => object.type === "consolidation")).toBe(true)
    expect(objects.filter((object) => object.type === "episode" && object.status === "superseded").length).toBe(2)
  })

  test("tombstone cascade hides derived atoms", async () => {
    const { runtime, objectStore } = createBootstrappedRuntime()

    const ingested = await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "secret cascade keyword",
          createdBy: { id: "agent", kind: "agent" },
        },
      ],
    })

    const episodeRef = ingested.results[0]?.ref
    expect(episodeRef).toBeDefined()

    await runtime.tombstone({
      scope,
      refs: [episodeRef!],
      reason: "cleanup",
      cascadePolicy: "tombstone_derived",
    })

    const query = await runtime.query({ scope, query: "secret" })
    expect(query.refs.length).toBe(0)

    const atoms = (await objectStore.list(scope)).filter((object) => object.type === "atom")
    expect(atoms.every((atom) => atom.status === "tombstoned")).toBe(true)
  })

  test("contradicts links mark memory disputed", async () => {
    const graphStore = new InMemoryGraphStore()
    const objectStore = new InMemoryObjectStore()
    const runtime = new MemoryRuntimeService(
      createRuntimeDeps(
        {
          episodeStore: new InMemoryEpisodeStore(),
          graphStore,
          indexStore: new InMemoryIndexStore(),
          metadataStore: new InMemoryMetadataStore(),
          objectStore,
        },
        createDefaultPluginHost(),
      ),
    )

    const episodeA = {
      id: "ep_a",
      type: "episode" as const,
      scope,
      createdAt: new Date().toISOString(),
      createdBy: { id: "agent", kind: "agent" as const },
      status: "active" as const,
      contentType: "text/plain",
      content: "claim alpha",
      metadata: {},
    }
    const episodeB = {
      id: "ep_b",
      type: "episode" as const,
      scope,
      createdAt: new Date().toISOString(),
      createdBy: { id: "agent", kind: "agent" as const },
      status: "active" as const,
      contentType: "text/plain",
      content: "claim beta",
      metadata: {},
    }
    await objectStore.upsert(episodeA)
    await objectStore.upsert(episodeB)

    const link: Link = {
      id: "lnk_contradict",
      type: "link",
      scope,
      status: "active",
      createdAt: new Date().toISOString(),
      createdBy: { id: "agent", kind: "agent" },
      linkType: "contradicts",
      from: { id: episodeA.id, type: "episode", scope },
      to: { id: episodeB.id, type: "episode", scope },
      metadata: {},
    }
    await graphStore.addLink(link)
    await objectStore.upsert(link)
    await (runtime as unknown as { applyLinkSideEffects: (value: Link) => Promise<void> }).applyLinkSideEffects(link)

    const hydrated = await runtime.hydrate({
      scope,
      refs: [
        { id: episodeA.id, type: "episode", scope },
        { id: episodeB.id, type: "episode", scope },
      ],
    })
    expect(hydrated.objects.every((object) => object.status === "disputed")).toBe(true)
  })
})
