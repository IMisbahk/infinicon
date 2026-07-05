import { describe, expect, test } from "bun:test"
import { InMemoryEpisodeStore } from "../src/adapters/inMemoryEpisodeStore"
import { InMemoryGraphStore } from "../src/adapters/inMemoryGraphStore"
import { InMemoryIndexStore } from "../src/adapters/inMemoryIndexStore"
import { InMemoryMetadataStore } from "../src/adapters/inMemoryMetadataStore"
import { IncrementingIdFactory } from "../src/core/id"
import { RuntimeService } from "../src/core/runtimeService"
import type { Scope } from "../src/core/types"

const scope: Scope = {
  tenantId: "tenant-1",
  namespaceId: "ns-1",
  agentId: "agent-1",
}

function createRuntime(): RuntimeService {
  return new RuntimeService(
    new InMemoryEpisodeStore(),
    new InMemoryGraphStore(),
    new InMemoryIndexStore(),
    new InMemoryMetadataStore(),
    new IncrementingIdFactory("rt"),
  )
}

describe("RuntimeService", () => {
  test("deduplicates ingest by scoped dedupe key", async () => {
    const runtime = createRuntime()

    const req = {
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "hello world",
          dedupeKey: "d1",
          createdBy: { id: "tester" },
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
          createdBy: { id: "tester" },
        },
      ],
    })

    const query = await runtime.query({
      scope,
      query: "bun runtime",
      consistency: "strong",
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
          content: "this is a somewhat longer memory that should exceed tiny token budget",
          createdBy: { id: "tester" },
        },
      ],
    })

    const assembled = await runtime.assembleContext({
      scope,
      task: "longer memory",
      budget: {
        maxTokens: 1,
      },
      consistency: "eventual",
    })

    expect(assembled.context.truncated).toBe(true)
    expect(assembled.context.segments.length).toBe(0)
    expect(assembled.context.warnings.some((w) => w.code === "truncated")).toBe(true)
    expect(assembled.context.warnings.some((w) => w.code === "eventual_consistency")).toBe(true)
  })

  test("assembleContext reports required_ref_omitted warning", async () => {
    const runtime = createRuntime()

    const ingest = await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "task memory",
          createdBy: { id: "tester" },
        },
      ],
    })

    const missingRef = {
      id: "episode-does-not-exist",
      type: "episode" as const,
      scope,
    }

    const assembled = await runtime.assembleContext({
      scope,
      task: "task",
      budget: {
        maxTokens: 100,
      },
      constraints: {
        mustIncludeRefs: [missingRef, ingest.results[0].ref],
        excludedRefs: [ingest.results[0].ref],
      },
    })

    expect(assembled.context.warnings.some((w) => w.code === "required_ref_omitted")).toBe(true)
    expect(assembled.context.segments.length).toBe(0)
  })

  test("tombstone removes memory from query and emits event", async () => {
    const runtime = createRuntime()

    const ingest = await runtime.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "remove me",
          createdBy: { id: "tester" },
        },
      ],
    })

    const targetRef = ingest.results[0].ref

    const result = await runtime.tombstone({
      scope,
      refs: [targetRef],
      reason: "test cleanup",
      cascadePolicy: "none",
    })

    expect(result.results[0].status).toBe("tombstoned")

    const query = await runtime.query({
      scope,
      query: "remove me",
    })
    expect(query.refs.length).toBe(0)

    const events = await runtime.subscribe({
      scope,
      eventTypes: ["memory.tombstoned"],
    })
    expect(events.events.length).toBe(1)
  })

  test("consolidate run_now creates completed job and emits events", async () => {
    const runtime = createRuntime()

    const consolidate = await runtime.consolidate({
      scope,
      trigger: "manual",
      mode: "run_now",
    })

    expect(consolidate.status).toBe("completed")

    const job = await runtime.getJob({
      scope,
      jobId: consolidate.jobId,
    })
    expect(job.status).toBe("completed")

    const events = await runtime.subscribe({
      scope,
      eventTypes: ["consolidation.started", "consolidation.completed"],
    })
    expect(events.events.length).toBe(2)
  })

  test("getJob throws for unknown job", async () => {
    const runtime = createRuntime()

    await expect(
      runtime.getJob({
        scope,
        jobId: "missing-job",
      }),
    ).rejects.toThrow("job not found")
  })
})
