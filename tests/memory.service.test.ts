import { describe, expect, test } from "bun:test"
import { MemoryService } from "../src/services/memoryService"
import { createInMemoryStoragePorts } from "../src/storage/inMemory"

const scope = { tenantId: "tenant-main", namespaceId: "ns-main" }

const buildService = () => new MemoryService(createInMemoryStoragePorts())

describe("memory service", () => {
  test("supports ingest -> query -> hydrate", async () => {
    const service = buildService()

    const ingest = await service.ingest({
      scope,
      episodes: [
        {
          contentType: "application/json",
          content: { text: "rust build flags" },
          dedupeKey: "dedupe-1",
          createdBy: { id: "agent-1", kind: "agent" },
          metadata: {},
        },
      ],
      consistency: "indexed",
    })

    expect(ingest.results[0]?.status).toBe("created")

    const query = await service.query({
      scope,
      query: "rust",
      limit: 5,
      consistency: "strong",
    })

    expect(query.refs.length).toBe(1)

    const hydrate = await service.hydrate({
      scope,
      refs: [query.refs[0]!.ref],
    })

    expect(hydrate.objects.length).toBe(1)
    expect(hydrate.missing.length).toBe(0)
  })

  test("returns deduplicated result on repeated dedupe key", async () => {
    const service = buildService()

    const request = {
      scope,
      episodes: [
        {
          contentType: "application/json",
          content: { text: "same event" },
          dedupeKey: "dup-1",
          createdBy: { id: "agent-1", kind: "agent" },
          metadata: {},
        },
      ],
    }

    const first = await service.ingest(request)
    const second = await service.ingest(request)

    expect(first.results[0]?.status).toBe("created")
    expect(second.results[0]?.status).toBe("deduplicated")
  })

  test("assembles bounded context and emits warnings", async () => {
    const service = buildService()

    await service.ingest({
      scope,
      episodes: [
        {
          contentType: "application/json",
          content: { text: "long detail long detail long detail long detail" },
          dedupeKey: "ctx-1",
          createdBy: { id: "agent-1", kind: "agent" },
          metadata: {},
        },
      ],
    })

    const assembled = await service.assembleContext({
      scope,
      task: "long detail",
      budget: { maxTokens: 2 },
      consistency: "eventual",
    })

    expect(assembled.context.warnings.length).toBeGreaterThan(0)
  })

  test("tombstones episode and removes from query path", async () => {
    const service = buildService()

    const ingest = await service.ingest({
      scope,
      episodes: [
        {
          contentType: "application/json",
          content: { text: "delete me" },
          dedupeKey: "del-1",
          createdBy: { id: "agent-1", kind: "agent" },
          metadata: {},
        },
      ],
    })

    const ref = ingest.results[0]!.ref
    const deleted = await service.tombstone({
      scope,
      refs: [ref],
      reason: "user requested deletion",
      cascadePolicy: "none",
    })

    expect(deleted.results[0]?.status).toBe("tombstoned")

    const query = await service.query({
      scope,
      query: "delete",
      limit: 5,
    })
    expect(query.refs.length).toBe(0)
  })

  test("creates consolidation job and returns status via getJob", async () => {
    const service = buildService()

    const queued = await service.consolidate({
      scope,
      trigger: "manual",
      mode: "enqueue",
    })

    const job = await service.getJob({ scope, jobId: queued.jobId })

    expect(job.status).toBe("queued")
  })
})
