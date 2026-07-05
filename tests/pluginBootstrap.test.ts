import { describe, expect, test } from "bun:test"
import { createDefaultPluginHost, createRuntimeDeps } from "../src/runtime/pluginBootstrap"
import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
  MemoryRuntimeService,
} from "../src/runtime"

describe("pluginBootstrap", () => {
  test("registers default runtime plugins on host", () => {
    const bootstrap = createDefaultPluginHost()
    const stats = bootstrap.host.stats()

    expect(stats.totalRegisteredPlugins).toBe(4)
    expect(stats.registeredByKind.embedder).toBe(1)
    expect(stats.registeredByKind.ranker).toBe(1)
    expect(stats.registeredByKind.extractor).toBe(1)
    expect(stats.registeredByKind.consolidator).toBe(1)
  })

  test("wires plugins into MemoryRuntimeService query path", async () => {
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

    const scope = { tenantId: "t1", namespaceId: "n1" }
    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "rust memory runtime",
          createdBy: { id: "agent", kind: "agent" },
        },
      ],
    })

    const result = await runtime.query({ scope, query: "rust memory" })
    expect(result.refs.length).toBeGreaterThan(0)
    expect(result.refs[0]?.reason).toContain("ranker")
  })

  test("extracts keyword atoms on ingest", async () => {
    const bootstrap = createDefaultPluginHost()
    const objectStore = new InMemoryObjectStore()
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

    const scope = { tenantId: "t1", namespaceId: "n1" }
    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "postgres vector retrieval pipeline",
          createdBy: { id: "agent", kind: "agent" },
        },
      ],
    })

    const objects = await objectStore.list(scope)
    const atoms = objects.filter((object) => object.type === "atom")
    expect(atoms.length).toBeGreaterThan(0)
    expect(atoms.some((atom) => atom.content === "postgres")).toBe(true)
  })

  test("consolidate run_now produces merged consolidation", async () => {
    const bootstrap = createDefaultPluginHost()
    const objectStore = new InMemoryObjectStore()
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

    const scope = { tenantId: "t1", namespaceId: "n1" }
    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "alpha note",
          createdBy: { id: "agent", kind: "agent" },
        },
        {
          contentType: "text/plain",
          content: "beta note",
          createdBy: { id: "agent", kind: "agent" },
        },
      ],
    })

    const consolidated = await runtime.consolidate({ scope, trigger: "manual", mode: "run_now" })
    expect(consolidated.status).toBe("completed")

    const job = await runtime.getJob({ scope, jobId: consolidated.jobId })
    expect(job.status).toBe("completed")

    const objects = await objectStore.list(scope)
    expect(objects.some((object) => object.type === "consolidation")).toBe(true)
  })
})
