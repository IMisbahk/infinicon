import { describe, expect, test } from "bun:test"
import { createInMemoryRuntime } from "../src/runtime"
import type { Scope } from "../src/types"

const scopeA: Scope = {
  tenantId: "tenant-a",
  namespaceId: "ns-a",
}

const scopeB: Scope = {
  tenantId: "tenant-a",
  namespaceId: "ns-b",
}

describe("InfiniconRuntime events and core API", () => {
  test("ingest emits lifecycle events and subscribe returns them in cursor order", async () => {
    const runtime = createInMemoryRuntime()

    const ingest = await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "hello memory runtime",
          dedupeKey: "msg-1",
          createdBy: { id: "user-1", type: "user" },
          metadata: { source: "test" },
        },
      ],
      consistency: "accepted",
    })

    expect(ingest.results).toHaveLength(1)
    expect(ingest.results[0]?.status).toBe("created")

    const sub = await runtime.subscribe({
      scope: scopeA,
      consistency: "strong",
    })

    expect(sub.events.length).toBeGreaterThanOrEqual(2)
    expect(sub.events[0]?.type).toBe("episode.ingested")
    expect(sub.events[1]?.type).toBe("memory.indexed")

    const cursorA = Number(sub.events[0]?.cursor)
    const cursorB = Number(sub.events[1]?.cursor)
    expect(cursorA).toBeLessThan(cursorB)
  })

  test("subscribe resume from cursor returns events at or after provided cursor", async () => {
    const runtime = createInMemoryRuntime()

    await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "first",
          dedupeKey: "first",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const initial = await runtime.subscribe({ scope: scopeA })
    const resumeCursor = initial.events[1]?.cursor
    expect(resumeCursor).toBeDefined()

    await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "second",
          dedupeKey: "second",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const resumed = await runtime.subscribe({
      scope: scopeA,
      cursor: resumeCursor!,
      consistency: "eventual",
    })

    expect(resumed.events.length).toBeGreaterThanOrEqual(1)
    expect(Number(resumed.events[0]?.cursor)).toBeGreaterThanOrEqual(Number(resumeCursor))
    expect(resumed.events[0]?.warnings).toContain("eventual_consistency")
  })

  test("subscribe with invalid cursor fails loud", async () => {
    const runtime = createInMemoryRuntime()

    await expect(
      runtime.subscribe({
        scope: scopeA,
        cursor: "99999",
      }),
    ).rejects.toMatchObject({
      code: "invalid_cursor",
    })
  })

  test("subscribe with known cursor from another scope fails with scope_mismatch", async () => {
    const runtime = createInMemoryRuntime()

    await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "in scope a",
          dedupeKey: "scope-a-known",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const inScopeA = await runtime.subscribe({ scope: scopeA })
    const foreignCursor = inScopeA.events[0]?.cursor
    expect(foreignCursor).toBeDefined()

    await expect(
      runtime.subscribe({
        scope: scopeB,
        cursor: foreignCursor!,
      }),
    ).rejects.toMatchObject({
      code: "scope_mismatch",
    })
  })

  test("subscribe unauthorized fails with unauthorized error", async () => {
    const runtime = createInMemoryRuntime({
      authorize: ({ action }) => action !== "subscribe",
    })

    await expect(runtime.subscribe({ scope: scopeA })).rejects.toMatchObject({
      code: "unauthorized",
    })
  })

  test("dedupe key conflict rejects divergent content in same scope", async () => {
    const runtime = createInMemoryRuntime()

    const created = await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "stable",
          dedupeKey: "dup-1",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    expect(created.results[0]?.status).toBe("created")

    const conflict = await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "changed",
          dedupeKey: "dup-1",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    expect(conflict.results[0]?.status).toBe("rejected")
    expect(conflict.results[0]?.error?.code).toBe("dedupe_conflict")
  })

  test("subscribe event type filtering returns only requested event types", async () => {
    const runtime = createInMemoryRuntime()

    await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "filter events",
          dedupeKey: "filter-1",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const filtered = await runtime.subscribe({
      scope: scopeA,
      eventTypes: ["memory.indexed"],
    })

    expect(filtered.events.length).toBeGreaterThan(0)
    for (const event of filtered.events) {
      expect(event.type).toBe("memory.indexed")
    }
  })

  test("scope isolation prevents cross-namespace event reads", async () => {
    const runtime = createInMemoryRuntime()

    await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "scope-a",
          dedupeKey: "scope-a-1",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    await runtime.ingest({
      scope: scopeB,
      episodes: [
        {
          contentType: "text/plain",
          content: "scope-b",
          dedupeKey: "scope-b-1",
          createdBy: { id: "user-2", type: "user" },
        },
      ],
    })

    const eventsA = await runtime.subscribe({ scope: scopeA })
    const eventsB = await runtime.subscribe({ scope: scopeB })

    expect(eventsA.events.length).toBeGreaterThan(0)
    expect(eventsB.events.length).toBeGreaterThan(0)
    for (const event of eventsA.events) {
      expect(event.scope.namespaceId).toBe("ns-a")
    }
    for (const event of eventsB.events) {
      expect(event.scope.namespaceId).toBe("ns-b")
    }
  })

  test("consolidate run_now creates a completed job retrievable by getJob", async () => {
    const runtime = createInMemoryRuntime()

    const consolidate = await runtime.consolidate({
      scope: scopeA,
      trigger: "manual",
      mode: "run_now",
    })

    expect(consolidate.status).toBe("completed")

    const job = await runtime.getJob({
      scope: scopeA,
      jobId: consolidate.jobId,
    })

    expect(job.type).toBe("consolidation")
    expect(job.status).toBe("completed")
    expect(job.result).toBeDefined()
  })

  test("getJob returns scope_mismatch when job is requested from another scope", async () => {
    const runtime = createInMemoryRuntime()

    const consolidate = await runtime.consolidate({
      scope: scopeA,
      trigger: "manual",
      mode: "enqueue",
    })

    const job = await runtime.getJob({
      scope: scopeB,
      jobId: consolidate.jobId,
    })

    expect(job.status).toBe("failed")
    expect(job.error?.code).toBe("scope_mismatch")
  })

  test("subscribe strong consistency can be disabled by capability flag", async () => {
    const runtime = createInMemoryRuntime({
      supportsStrongSubscribeConsistency: false,
    })

    await expect(
      runtime.subscribe({
        scope: scopeA,
        consistency: "strong",
      }),
    ).rejects.toMatchObject({
      code: "consistency_not_supported",
    })
  })

  test("tombstone removes item from hydrate and query results", async () => {
    const runtime = createInMemoryRuntime()

    const ingest = await runtime.ingest({
      scope: scopeA,
      episodes: [
        {
          contentType: "text/plain",
          content: "remove me",
          dedupeKey: "rm-1",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const ref = ingest.results[0]?.ref
    expect(ref).toBeDefined()

    const beforeQuery = await runtime.query({ scope: scopeA, query: "remove", limit: 10 })
    expect(beforeQuery.refs.length).toBeGreaterThan(0)

    const tombstone = await runtime.tombstone({
      scope: scopeA,
      refs: [ref!],
      reason: "test cleanup",
      cascadePolicy: "none",
    })

    expect(tombstone.results[0]?.status).toBe("tombstoned")

    const afterQuery = await runtime.query({ scope: scopeA, query: "remove", limit: 10 })
    expect(afterQuery.refs).toHaveLength(0)

    const hydrated = await runtime.hydrate({ scope: scopeA, refs: [ref!] })
    expect(hydrated.objects).toHaveLength(0)
    expect(hydrated.missing).toHaveLength(1)
  })
})
