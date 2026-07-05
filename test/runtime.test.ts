import { describe, expect, it } from "bun:test"
import { InMemoryEpisodeStore, InMemoryGraphStore, InMemoryIndexStore, InMemoryMetadataStore } from "../src/runtime/in-memory-stores"
import { createDerivedLink, MemoryRuntimeService } from "../src/runtime/memory-runtime"

function createRuntime() {
  return new MemoryRuntimeService({
    episodeStore: new InMemoryEpisodeStore(),
    graphStore: new InMemoryGraphStore(),
    indexStore: new InMemoryIndexStore(),
    metadataStore: new InMemoryMetadataStore(),
  })
}

describe("memory runtime", () => {
  it("ingests episodes idempotently via dedupe key", async () => {
    const runtime = createRuntime()
    const scope = { tenantId: "t1", namespaceId: "n1" }

    const first = await runtime.ingest({
      scope,
      episodes: [{
        contentType: "text/plain",
        content: "hello world",
        dedupeKey: "d-1",
        createdBy: "agent",
        metadata: {},
      }],
      consistency: "accepted",
    })

    expect(first.ok).toBe(true)
    if (!first.ok) return

    const second = await runtime.ingest({
      scope,
      episodes: [{
        contentType: "text/plain",
        content: "hello world changed",
        dedupeKey: "d-1",
        createdBy: "agent",
        metadata: {},
      }],
      consistency: "accepted",
    })

    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.results[0].status).toBe("deduplicated")
    expect(second.value.results[0].ref.id).toBe(first.value.results[0].ref.id)
  })

  it("queries and hydrates active memory", async () => {
    const runtime = createRuntime()
    const scope = { tenantId: "t1", namespaceId: "n1" }

    await runtime.ingest({
      scope,
      episodes: [{
        contentType: "text/plain",
        content: "incident timeline root cause deploy",
        dedupeKey: "d-2",
        createdBy: "agent",
        metadata: {},
      }],
      consistency: "indexed",
    })

    const query = await runtime.query({ scope, query: "incident timeline", consistency: "strong", limit: 10 })
    expect(query.ok).toBe(true)
    if (!query.ok) return
    expect(query.value.refs.length).toBeGreaterThan(0)

    const hydrate = await runtime.hydrate({ scope, refs: query.value.refs.map(r => r.ref) })
    expect(hydrate.ok).toBe(true)
    if (!hydrate.ok) return
    expect(hydrate.value.objects.length).toBe(query.value.refs.length)
  })

  it("assembles bounded context and warns on truncation", async () => {
    const runtime = createRuntime()
    const scope = { tenantId: "t1", namespaceId: "n1" }

    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "incident timeline root cause deploy rollback monitoring alerts",
          dedupeKey: "d-3",
          createdBy: "agent",
          metadata: {},
        },
      ],
    })

    const result = await runtime.assembleContext({
      scope,
      task: "incident timeline root cause deploy",
      budget: { maxTokens: 2 },
      consistency: "eventual",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.context.warnings.some(w => w.code === "truncated" || w.code === "empty_context")).toBe(true)
  })

  it("tombstones source and marks derived stale for mark_derived_stale", async () => {
    const episodeStore = new InMemoryEpisodeStore()
    const graphStore = new InMemoryGraphStore()
    const indexStore = new InMemoryIndexStore()
    const metadataStore = new InMemoryMetadataStore()
    const runtime = new MemoryRuntimeService({ episodeStore, graphStore, indexStore, metadataStore })

    const scope = { tenantId: "t1", namespaceId: "n1" }
    const ingest = await runtime.ingest({
      scope,
      episodes: [{
        contentType: "text/plain",
        content: "source memory",
        dedupeKey: "d-4",
        createdBy: "agent",
        metadata: {},
      }],
    })
    if (!ingest.ok) throw new Error("ingest failed")

    const sourceRef = ingest.value.results[0].ref
    const derivedRef = { id: "atom_1", type: "atom" as const, scope }
    await metadataStore.putObject({
      id: derivedRef.id,
      type: "atom",
      scope,
      status: "active",
      createdAt: new Date().toISOString(),
      content: "derived",
      metadata: {},
    })

    await createDerivedLink(graphStore, scope, derivedRef, sourceRef)

    const tombstone = await runtime.tombstone({
      scope,
      refs: [sourceRef],
      reason: "delete",
      cascadePolicy: "mark_derived_stale",
    })

    expect(tombstone.ok).toBe(true)
    if (!tombstone.ok) return

    const derivedObject = await metadataStore.getObject(derivedRef)
    expect(derivedObject?.status).toBe("disputed")
  })

  it("creates and retrieves consolidation jobs", async () => {
    const runtime = createRuntime()
    const scope = { tenantId: "t1", namespaceId: "n1" }

    const consolidate = await runtime.consolidate({ scope, trigger: "manual", mode: "run_now" })
    expect(consolidate.ok).toBe(true)
    if (!consolidate.ok) return

    const job = await runtime.getJob({ scope, jobId: consolidate.value.jobId })
    expect(job.ok).toBe(true)
    if (!job.ok) return
    expect(job.value.status).toBe("completed")
  })
})
