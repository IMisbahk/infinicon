import { describe, expect, test } from "bun:test"
import { InMemoryGraphStore } from "../src/adapters/inMemoryGraphStore"
import { InMemoryIndexStore } from "../src/adapters/inMemoryIndexStore"
import { InMemoryMetadataStore } from "../src/adapters/inMemoryMetadataStore"
import type { Episode, Link, Scope } from "../src/core/types"

const scope: Scope = {
  tenantId: "tenant-1",
  namespaceId: "ns-1",
  agentId: "agent-1",
}

function episode(id: string, content: string, status: Episode["status"] = "active"): Episode {
  return {
    id,
    type: "episode",
    scope,
    createdAt: new Date().toISOString(),
    createdBy: { id: "tester" },
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
    createdBy: { id: "tester" },
    status,
    linkType: "derived_from",
    from: { id: fromId, type: "episode", scope },
    to: { id: toId, type: "episode", scope },
    metadata: {},
  }
}

describe("InMemoryIndexStore", () => {
  test("search excludes tombstoned episodes", async () => {
    const store = new InMemoryIndexStore()
    await store.indexEpisode(episode("ep-1", "alpha memory"))
    await store.indexEpisode(episode("ep-2", "alpha tombstoned", "tombstoned"))

    const rows = await store.search({ scope, query: "alpha" })
    expect(rows.length).toBe(1)
    expect(rows[0].ref.id).toBe("ep-1")
  })

  test("removeEpisode makes result disappear", async () => {
    const store = new InMemoryIndexStore()
    await store.indexEpisode(episode("ep-1", "remove target"))
    await store.removeEpisode({ id: "ep-1", type: "episode", scope })

    const rows = await store.search({ scope, query: "remove" })
    expect(rows.length).toBe(0)
  })
})

describe("InMemoryGraphStore", () => {
  test("fetches incoming/outgoing and tombstone hides link", async () => {
    const store = new InMemoryGraphStore()
    const l1 = link("l1", "a", "b")
    await store.addLink(l1)

    const outgoing = await store.fetchOutgoing({ id: "a", type: "episode", scope })
    const incoming = await store.fetchIncoming({ id: "b", type: "episode", scope })
    expect(outgoing.length).toBe(1)
    expect(incoming.length).toBe(1)

    const changed = await store.tombstoneLink("l1", scope)
    expect(changed).toBe(true)

    const outgoingAfter = await store.fetchOutgoing({ id: "a", type: "episode", scope })
    expect(outgoingAfter.length).toBe(0)
  })

  test("fetchProvenanceChain walks links up to depth", async () => {
    const store = new InMemoryGraphStore()
    await store.addLink(link("l1", "a", "b"))
    await store.addLink(link("l2", "b", "c"))

    const chainDepth1 = await store.fetchProvenanceChain({ id: "a", type: "episode", scope }, 1)
    const chainDepth2 = await store.fetchProvenanceChain({ id: "a", type: "episode", scope }, 2)

    expect(chainDepth1.length).toBe(1)
    expect(chainDepth2.length).toBe(2)
  })
})

describe("InMemoryMetadataStore", () => {
  test("stores and retrieves jobs by scope", async () => {
    const store = new InMemoryMetadataStore()
    const now = new Date().toISOString()

    await store.createJob({
      jobId: "job-1",
      scope,
      type: "consolidation",
      status: "queued",
      createdAt: now,
      updatedAt: now,
    })

    const job = await store.getJob(scope, "job-1")
    expect(job?.jobId).toBe("job-1")
  })

  test("filters subscribe events by type and cursor", async () => {
    const store = new InMemoryMetadataStore()

    await store.appendEvent({
      id: "e1",
      scope,
      type: "episode.ingested",
      at: new Date().toISOString(),
      payload: { id: 1 },
      cursor: "1",
    })

    await store.appendEvent({
      id: "e2",
      scope,
      type: "memory.tombstoned",
      at: new Date().toISOString(),
      payload: { id: 2 },
      cursor: "2",
    })

    const first = await store.listEvents({ scope, eventTypes: ["memory.tombstoned"] })
    expect(first.length).toBe(1)
    expect(first[0].id).toBe("e2")

    const second = await store.listEvents({ scope, cursor: "1" })
    expect(second.length).toBe(1)
    expect(second[0].id).toBe("e2")
  })
})
