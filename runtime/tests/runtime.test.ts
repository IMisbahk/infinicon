import { describe, expect, test } from "bun:test"
import { InMemoryRuntime } from "../src/runtime"
import type { Scope } from "../src/types"

const scopeA: Scope = { tenantId: "tenant-a", namespaceId: "ns-a" }
const scopeB: Scope = { tenantId: "tenant-a", namespaceId: "ns-b" }

const actor = { id: "agent-1", type: "agent" }

describe("InMemoryRuntime", () => {
  test("ingest is idempotent with dedupe key", () => {
    const runtime = new InMemoryRuntime()

    const first = runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "hello world", dedupeKey: "k1", createdBy: actor }],
      consistency: "indexed",
    })
    const second = runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "hello world", dedupeKey: "k1", createdBy: actor }],
      consistency: "indexed",
    })

    expect(first.results[0]?.status).toBe("created")
    expect(second.results[0]?.status).toBe("deduplicated")
    expect(second.results[0]?.ref.id).toBe(first.results[0]?.ref.id)
  })

  test("ingest rejects dedupe key conflict", () => {
    const runtime = new InMemoryRuntime()

    runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "hello world", dedupeKey: "k1", createdBy: actor }],
    })

    const conflict = runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "different", dedupeKey: "k1", createdBy: actor }],
    })

    expect(conflict.results[0]?.status).toBe("rejected")
    expect(conflict.results[0]?.error?.code).toBe("dedupe_conflict")
  })

  test("query is scope isolated by namespace", () => {
    const runtime = new InMemoryRuntime()

    runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "billing outage", createdBy: actor }],
      consistency: "indexed",
    })
    runtime.ingest({
      scope: scopeB,
      episodes: [{ contentType: "text/plain", content: "billing outage", createdBy: actor }],
      consistency: "indexed",
    })

    const inA = runtime.query({ scope: scopeA, query: "billing", consistency: "strong" })
    const inB = runtime.query({ scope: scopeB, query: "billing", consistency: "strong" })

    expect(inA.refs.length).toBe(1)
    expect(inB.refs.length).toBe(1)
    expect(inA.refs[0]?.ref.scope.namespaceId).toBe("ns-a")
    expect(inB.refs[0]?.ref.scope.namespaceId).toBe("ns-b")
  })

  test("tombstoned memory is excluded from query and hydrate", () => {
    const runtime = new InMemoryRuntime()

    const ingest = runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "remove me", createdBy: actor }],
      consistency: "indexed",
    })

    const ref = ingest.results[0]!.ref
    const tombstone = runtime.tombstone({
      scope: scopeA,
      refs: [ref],
      reason: "test",
      cascadePolicy: "none",
    })

    expect(tombstone.results[0]?.status).toBe("tombstoned")

    const query = runtime.query({ scope: scopeA, query: "remove", consistency: "strong" })
    expect(query.refs.length).toBe(0)

    const hydrate = runtime.hydrate({ scope: scopeA, refs: [ref] })
    expect(hydrate.objects.length).toBe(0)
    expect(hydrate.missing.length).toBe(1)
  })

  test("assembleContext returns warnings for eventual and required omissions", () => {
    const runtime = new InMemoryRuntime()

    const ingest = runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "critical deployment detail", createdBy: actor }],
      consistency: "indexed",
    })

    const requiredRef = ingest.results[0]!.ref

    const response = runtime.assembleContext({
      scope: scopeA,
      task: "critical deployment",
      budget: { maxTokens: 1 },
      consistency: "eventual",
      constraints: { mustIncludeRefs: [requiredRef] },
    })

    const warningCodes = response.context.warnings.map((warning) => warning.code)
    expect(warningCodes.includes("eventual_consistency")).toBe(true)
    expect(warningCodes.includes("truncated") || warningCodes.includes("required_ref_omitted")).toBe(true)
  })

  test("assembleContext includes required refs when budget allows even if query misses", () => {
    const runtime = new InMemoryRuntime()

    const ingest = runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "operator runbook", createdBy: actor }],
      consistency: "indexed",
    })

    const requiredRef = ingest.results[0]!.ref

    const response = runtime.assembleContext({
      scope: scopeA,
      task: "completely unrelated terms",
      budget: { maxTokens: 256 },
      consistency: "strong",
      constraints: { mustIncludeRefs: [requiredRef] },
    })

    expect(response.context.segments.some((segment) => segment.ref.id === requiredRef.id)).toBe(true)
    const warningCodes = response.context.warnings.map((warning) => warning.code)
    expect(warningCodes.includes("required_ref_omitted")).toBe(false)
  })

  test("consolidate run_now creates completed job", () => {
    const runtime = new InMemoryRuntime()

    const consolidation = runtime.consolidate({
      scope: scopeA,
      trigger: "manual",
      mode: "run_now",
    })

    expect(consolidation.status).toBe("completed")

    const job = runtime.getJob({
      scope: scopeA,
      jobId: consolidation.jobId,
    })

    expect(job.status).toBe("completed")
  })

  test("consolidate enqueue creates queued job", () => {
    const runtime = new InMemoryRuntime()

    const consolidation = runtime.consolidate({
      scope: scopeA,
      trigger: "idle",
      mode: "enqueue",
    })

    expect(consolidation.status).toBe("queued")

    const job = runtime.getJob({
      scope: scopeA,
      jobId: consolidation.jobId,
    })

    expect(job.status).toBe("queued")
  })

  test("subscribe returns lifecycle events", () => {
    const runtime = new InMemoryRuntime()

    runtime.ingest({
      scope: scopeA,
      episodes: [{ contentType: "text/plain", content: "event me", createdBy: actor }],
      consistency: "indexed",
    })

    const events = runtime.subscribe({
      scope: scopeA,
      eventTypes: ["episode.ingested", "memory.indexed"],
    })

    expect(events.events.length).toBeGreaterThanOrEqual(2)
  })
})
