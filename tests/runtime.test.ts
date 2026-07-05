import { describe, expect, test } from "bun:test"
import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
  MemoryRuntimeService,
  type Episode,
  type Link,
  type Scope,
} from "../src/runtime"

const scope: Scope = {
  tenantId: "tenant-1",
  namespaceId: "ns-1",
  agentId: "agent-1",
}

function createRuntime(): MemoryRuntimeService {
  return new MemoryRuntimeService({
    episodeStore: new InMemoryEpisodeStore(),
    graphStore: new InMemoryGraphStore(),
    indexStore: new InMemoryIndexStore(),
    metadataStore: new InMemoryMetadataStore(),
    objectStore: new InMemoryObjectStore(),
  })
}

function episode(id: string, content: string, status: Episode["status"] = "active"): Episode {
  return {
    id,
    type: "episode",
    scope,
    createdAt: new Date().toISOString(),
    createdBy: { id: "tester", kind: "system" },
    status,
    contentType: "text/plain",
    content,
    metadata: {},
  }
}

function link(id: string, fromId: string, toId: string, status: Link["status"] = "active"): Link {
  return {
    id,
    type: "link",
    scope,
    createdAt: new Date().toISOString(),
    createdBy: { id: "tester", kind: "system" },
    status,
    linkType: "derived_from",
    from: { id: fromId, type: "episode", scope },
    to: { id: toId, type: "episode", scope },
    metadata: {},
  }
}

describe("MemoryRuntimeService", () => {
  test("deduplicates ingest by scoped dedupe key", async () => {
    const runtime = createRuntime()

    const req = {
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "hello world",
          dedupeKey: "d1",
          createdBy: { id: "tester", kind: "system" as const },
        },
      ],
      consistency: "accepted" as const,
    }

    const first = await runtime.ingest(req)
    const second = await runtime.ingest(req)

    expect(first.results[0].status).toBe("created")
    expect(second.results[0].status).toBe("deduplicated")
    expect(first.results[0].ref.id).toBe(second.results[0].ref.id)
  })

  test("query returns refs and hydrate returns content", async () => {
    const runtime = createRuntime()

    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "memory about bun runtime",
          createdBy: { id: "tester", kind: "system" },
        },
      ],
    })

    const query = await runtime.query({
      scope,
      query: "bun runtime",
      consistency: "eventual",
    })

    expect(query.refs.length).toBe(1)

    const hydrate = await runtime.hydrate({
      scope,
      refs: [query.refs[0].ref],
      includeProvenance: false,
    })

    expect(hydrate.objects.length).toBe(1)
    expect(hydrate.objects[0].content).toBe("memory about bun runtime")
  })

  test("assembleContext respects token budget and reports truncation", async () => {
    const runtime = createRuntime()

    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "first memory chunk",
          createdBy: { id: "tester", kind: "system" },
        },
        {
          contentType: "text/plain",
          content: "second memory chunk that should not fit in tiny budget",
          createdBy: { id: "tester", kind: "system" },
        },
      ],
    })

    const assembled = await runtime.assembleContext({
      scope,
      task: "memory",
      budget: {
        maxTokens: 5,
      },
    })

    expect(assembled.context.truncated).toBe(true)
    expect(assembled.context.warnings.some((w) => w.code === "truncated")).toBe(true)
  })

  test("tombstone hides content from query", async () => {
    const runtime = createRuntime()

    const ingested = await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "secret memory to tombstone",
          createdBy: { id: "tester", kind: "system" },
        },
      ],
    })

    const ref = ingested.results[0].ref
    await runtime.tombstone({
      scope,
      refs: [ref],
      reason: "cleanup",
      cascadePolicy: "none",
    })

    const query = await runtime.query({ scope, query: "secret" })
    expect(query.refs.length).toBe(0)
  })

  test("getJob returns job metadata", async () => {
    const runtime = createRuntime()

    const consolidated = await runtime.consolidate({
      scope,
      trigger: "manual",
    })

    const job = await runtime.getJob({
      scope,
      jobId: consolidated.jobId,
    })

    expect(job.jobId).toBe(consolidated.jobId)
    expect(job.status).toBe("queued")
  })

  test("subscribe returns scoped events", async () => {
    const runtime = createRuntime()

    await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "event test",
          createdBy: { id: "tester", kind: "system" },
        },
      ],
    })

    const events = await runtime.subscribe({
      scope,
      eventTypes: ["episode.ingested"],
    })

    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe("episode.ingested")
  })
})

describe("InMemoryIndexStore", () => {
  test("search ranks lexical matches", async () => {
    const store = new InMemoryIndexStore()
    const ep1 = episode("ep-1", "alpha memory")
    await store.indexMemory({ ref: { id: ep1.id, type: "episode", scope }, text: "alpha memory" })
    await store.indexMemory({ ref: { id: "ep-2", type: "episode", scope }, text: "unrelated" })

    const rows = await store.search(scope, "alpha")
    expect(rows.length).toBe(1)
    expect(rows[0].ref.id).toBe("ep-1")
  })

  test("removeIndexed makes result disappear", async () => {
    const store = new InMemoryIndexStore()
    const ep = episode("ep-1", "remove target")
    await store.indexMemory({ ref: { id: ep.id, type: "episode", scope }, text: "remove target" })
    await store.removeIndexed({ id: ep.id, type: "episode", scope })

    const rows = await store.search(scope, "remove")
    expect(rows.length).toBe(0)
  })
})

describe("InMemoryGraphStore", () => {
  test("fetches incoming/outgoing and tombstone hides link", async () => {
    const store = new InMemoryGraphStore()
    const l1 = link("l1", "a", "b")
    await store.addLink(l1)

    const outgoing = await store.getOutgoingLinks({ id: "a", type: "episode", scope })
    const incoming = await store.getIncomingLinks({ id: "b", type: "episode", scope })
    expect(outgoing.length).toBe(1)
    expect(incoming.length).toBe(1)

    const changed = await store.tombstoneLink({ id: "l1", type: "link", scope })
    expect(changed).toBe("tombstoned")

    const outgoingAfter = await store.getOutgoingLinks({ id: "a", type: "episode", scope })
    expect(outgoingAfter.length).toBe(0)
  })

  test("getProvenanceChain walks incoming links up to depth", async () => {
    const store = new InMemoryGraphStore()
    await store.addLink(link("l1", "a", "b"))
    await store.addLink(link("l2", "b", "c"))

    const chainDepth1 = await store.getProvenanceChain({ id: "c", type: "episode", scope }, 1)
    const chainDepth2 = await store.getProvenanceChain({ id: "c", type: "episode", scope }, 2)

    expect(chainDepth1.length).toBe(1)
    expect(chainDepth2.length).toBe(2)
  })
})

describe("InMemoryMetadataStore", () => {
  test("stores and retrieves jobs by scope", async () => {
    const store = new InMemoryMetadataStore()
    const now = new Date().toISOString()

    await store.upsertJob({
      jobId: "job-1",
      scope,
      kind: "consolidation",
      status: "queued",
      createdAt: now,
      updatedAt: now,
    })

    const job = await store.getJob(scope, "job-1")
    expect(job?.jobId).toBe("job-1")
  })

  test("stores scoped events for subscribe", async () => {
    const store = new InMemoryMetadataStore()
    await store.storeScope(scope)

    await store.appendEvent({
      id: "e1",
      scope,
      type: "episode.ingested",
      timestamp: new Date().toISOString(),
      payload: { id: 1 },
    })

    await store.appendEvent({
      id: "e2",
      scope,
      type: "memory.tombstoned",
      timestamp: new Date().toISOString(),
      payload: { id: 2 },
    })

    const all = await store.listEvents(scope)
    expect(all.length).toBe(2)
    expect(all.map((event) => event.type)).toContain("memory.tombstoned")
  })
})
