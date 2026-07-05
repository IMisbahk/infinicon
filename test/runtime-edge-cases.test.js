import test from "node:test"
import assert from "node:assert/strict"
import { MemoryRuntime } from "../packages/runtime-core/src/runtime.js"
import { createInMemoryAdapter } from "../packages/runtime-adapters-memory/src/memory-adapter.js"

function createScope(overrides = {}) {
  return { tenantId: "tenant-edge", namespaceId: "namespace-edge", ...overrides }
}

function createRuntime() {
  return new MemoryRuntime(createInMemoryAdapter())
}

test("query validation rejects invalid limit", async () => {
  const runtime = createRuntime()
  await assert.rejects(
    runtime.query({
      scope: createScope(),
      query: "x",
      limit: 0,
    }),
    (error) => error.code === "invalid_request",
  )
})

test("hydrate validation rejects malformed refs", async () => {
  const runtime = createRuntime()
  await assert.rejects(
    runtime.hydrate({
      scope: createScope(),
      refs: [{}],
    }),
    (error) => error.code === "invalid_request",
  )
})

test("tombstone validation requires reason and refs", async () => {
  const runtime = createRuntime()
  await assert.rejects(
    runtime.tombstone({
      scope: createScope(),
      refs: [],
      reason: "",
      cascadePolicy: "none",
    }),
    (error) => error.code === "invalid_request",
  )
})

test("subscribe returns accumulated lifecycle events", async () => {
  const runtime = createRuntime()
  const scope = createScope()

  await runtime.ingest({
    scope,
    episodes: [
      {
        contentType: "text/plain",
        content: "eventful memory",
        dedupeKey: "evt-1",
      },
    ],
    consistency: "accepted",
  })

  const subscription = await runtime.subscribe({
    scope,
    eventTypes: ["episode.ingested"],
  })

  assert.ok(Array.isArray(subscription.events))
  assert.ok(subscription.events.length >= 1)
  assert.equal(subscription.events[0].type, "episode.ingested")
})

test("getJob validates jobId presence", async () => {
  const runtime = createRuntime()
  await assert.rejects(
    runtime.getJob({
      scope: createScope(),
      jobId: "",
    }),
    (error) => error.code === "invalid_request",
  )
})
