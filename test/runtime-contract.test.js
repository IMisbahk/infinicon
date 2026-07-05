import test from "node:test"
import assert from "node:assert/strict"
import { MemoryRuntime } from "../packages/runtime-core/src/runtime.js"
import { createInMemoryAdapter } from "../packages/runtime-adapters-memory/src/memory-adapter.js"

function createScope(overrides = {}) {
  return {
    tenantId: "tenant-a",
    namespaceId: "namespace-a",
    ...overrides,
  }
}

function createRuntime() {
  return new MemoryRuntime(createInMemoryAdapter())
}

test("ingest supports dedupe and rejects dedupe conflicts", async () => {
  const runtime = createRuntime()
  const scope = createScope()

  const first = await runtime.ingest({
    scope,
    episodes: [
      {
        contentType: "text/plain",
        content: "hello world",
        dedupeKey: "same",
        createdBy: { type: "agent", id: "agent-1" },
      },
    ],
    consistency: "accepted",
  })

  assert.equal(first.results[0].status, "created")

  const second = await runtime.ingest({
    scope,
    episodes: [
      {
        contentType: "text/plain",
        content: "hello world",
        dedupeKey: "same",
        createdBy: { type: "agent", id: "agent-1" },
      },
    ],
    consistency: "accepted",
  })

  assert.equal(second.results[0].status, "deduplicated")

  const conflict = await runtime.ingest({
    scope,
    episodes: [
      {
        contentType: "text/plain",
        content: "different payload",
        dedupeKey: "same",
        createdBy: { type: "agent", id: "agent-1" },
      },
    ],
    consistency: "accepted",
  })

  assert.equal(conflict.results[0].status, "rejected")
  assert.equal(conflict.results[0].error.code, "dedupe_conflict")
})

test("query returns refs and scores without hydrated content", async () => {
  const runtime = createRuntime()
  const scope = createScope()

  const ingest = await runtime.ingest({
    scope,
    episodes: [
      {
        contentType: "text/plain",
        content: "memory about vector search",
        dedupeKey: "q-1",
      },
    ],
    consistency: "accepted",
  })

  const query = await runtime.query({
    scope,
    query: "vector",
    consistency: "strong",
  })

  assert.ok(query.refs.length > 0)
  assert.equal(typeof query.refs[0].ref.id, "string")
  assert.equal(typeof query.refs[0].score, "number")
  assert.equal(query.refs[0].content, undefined)
  assert.equal(query.refs[0].ref.id, ingest.results[0].ref.id)
})

test("hydrate reports missing refs", async () => {
  const runtime = createRuntime()
  const scope = createScope()

  const hydrate = await runtime.hydrate({
    scope,
    refs: [{ id: "missing", type: "episode", scope }],
    includeProvenance: true,
  })

  assert.equal(hydrate.objects.length, 0)
  assert.equal(hydrate.missing.length, 1)
  assert.equal(hydrate.missing[0].id, "missing")
})

test("tombstoned memory is excluded from query and context", async () => {
  const runtime = createRuntime()
  const scope = createScope()

  const ingest = await runtime.ingest({
    scope,
    episodes: [
      {
        contentType: "text/plain",
        content: "keep this private",
        dedupeKey: "t-1",
      },
    ],
    consistency: "accepted",
  })

  const ref = ingest.results[0].ref

  await runtime.tombstone({
    scope,
    refs: [ref],
    reason: "test tombstone",
    cascadePolicy: "none",
  })

  const query = await runtime.query({
    scope,
    query: "private",
    consistency: "strong",
  })

  assert.equal(query.refs.length, 0)

  const context = await runtime.assembleContext({
    scope,
    task: "find private data",
    budget: { maxTokens: 128 },
    consistency: "strong",
  })

  assert.equal(context.context.segments.length, 0)
  assert.ok(context.context.warnings.some((warning) => warning.code === "empty_context"))
})

test("assembleContext emits truncation and required ref warnings", async () => {
  const runtime = createRuntime()
  const scope = createScope()

  const ingest = await runtime.ingest({
    scope,
    episodes: [
      { contentType: "text/plain", content: "alpha beta gamma delta", dedupeKey: "a1" },
      { contentType: "text/plain", content: "epsilon zeta eta theta", dedupeKey: "a2" },
    ],
    consistency: "accepted",
  })

  const mustIncludeRef = ingest.results[1].ref
  const context = await runtime.assembleContext({
    scope,
    task: "alpha epsilon",
    budget: { maxTokens: 2 },
    constraints: {
      maxSegments: 1,
      mustIncludeRefs: [mustIncludeRef],
    },
    consistency: "eventual",
  })

  assert.ok(context.context.warnings.some((warning) => warning.code === "truncated"))
  assert.ok(context.context.warnings.some((warning) => warning.code === "required_ref_omitted"))
  assert.ok(context.context.warnings.some((warning) => warning.code === "eventual_consistency"))
})
