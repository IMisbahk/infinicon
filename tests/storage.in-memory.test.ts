import { describe, expect, test } from "bun:test"
import { createInMemoryStoragePorts } from "../src/storage/inMemory"

const scope = { tenantId: "tenant-a", namespaceId: "ns-a" }

describe("in-memory storage ports", () => {
  test("supports episode append, dedupe lookup, and tombstone behavior", async () => {
    const storage = createInMemoryStoragePorts()

    await storage.episodes.append({
      id: "ep_1",
      type: "episode",
      scope,
      createdAt: new Date().toISOString(),
      createdBy: { id: "agent-1", kind: "agent" },
      status: "active",
      metadata: {},
      content: { text: "hello" },
      dedupeKey: "k1",
    })

    const dedupeHit = await storage.episodes.findByDedupeKey(scope, "k1")
    expect(dedupeHit?.id).toBe("ep_1")

    const tombstoned = await storage.episodes.tombstone(scope, {
      id: "ep_1",
      type: "episode",
      scope,
    })
    expect(tombstoned).toBe(true)

    const missingAfterTombstone = await storage.episodes.findByRef(scope, {
      id: "ep_1",
      type: "episode",
      scope,
    })
    expect(missingAfterTombstone).toBeNull()
  })

  test("supports index search and hide on remove", async () => {
    const storage = createInMemoryStoragePorts()

    const ref = { id: "ep_2", type: "episode" as const, scope }
    await storage.index.index(scope, {
      ref,
      text: "rust build flags and bun runtime",
      status: "active",
      updatedAt: new Date().toISOString(),
    })

    const beforeRemove = await storage.index.search(scope, "rust", 5)
    expect(beforeRemove.length).toBe(1)

    await storage.index.remove(scope, ref)
    const afterRemove = await storage.index.search(scope, "rust", 5)
    expect(afterRemove.length).toBe(0)
  })
})
