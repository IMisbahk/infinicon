import { describe, expect, test } from "bun:test"

import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
  MemoryRuntimeService,
  type Scope,
} from "../src/runtime"

const scope: Scope = {
  tenantId: "tenant-a",
  namespaceId: "ns-a",
  agentId: "agent-1",
  sessionId: "session-1",
}

const createService = (): MemoryRuntimeService => {
  return new MemoryRuntimeService({
    episodeStore: new InMemoryEpisodeStore(),
    graphStore: new InMemoryGraphStore(),
    indexStore: new InMemoryIndexStore(),
    metadataStore: new InMemoryMetadataStore(),
    objectStore: new InMemoryObjectStore(),
  })
}

describe("MemoryRuntimeService", () => {
  test("ingest is idempotent with dedupe key", async () => {
    const service = createService()

    const first = await service.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "remember this",
          dedupeKey: "msg-1",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const second = await service.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "remember this",
          dedupeKey: "msg-1",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    expect(first.results[0].status).toBe("created")
    expect(second.results[0].status).toBe("deduplicated")
    expect(second.results[0].ref.id).toBe(first.results[0].ref.id)
  })

  test("query respects scope isolation", async () => {
    const service = createService()

    await service.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "secret alpha",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const outsideScope: Scope = {
      tenantId: "tenant-a",
      namespaceId: "ns-b",
      agentId: "agent-1",
      sessionId: "session-1",
    }

    const foundInScope = await service.query({ scope, query: "secret", consistency: "eventual" })
    const foundOutsideScope = await service.query({
      scope: outsideScope,
      query: "secret",
      consistency: "eventual",
    })

    expect(foundInScope.refs.length).toBe(1)
    expect(foundOutsideScope.refs.length).toBe(0)
  })

  test("assembleContext reports empty_context when no matches", async () => {
    const service = createService()
    const response = await service.assembleContext({
      scope,
      task: "missing memory",
      budget: { maxTokens: 128 },
      consistency: "eventual",
    })

    expect(response.context.segments.length).toBe(0)
    expect(response.context.warnings.some((warning) => warning.code === "empty_context")).toBe(true)
  })

  test("tombstone excludes memory from query", async () => {
    const service = createService()

    const ingest = await service.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "remove me",
          createdBy: { id: "user-1", type: "user" },
        },
      ],
    })

    const ref = ingest.results[0].ref
    await service.tombstone({
      scope,
      refs: [ref],
      reason: "test deletion",
      cascadePolicy: "none",
    })

    const query = await service.query({ scope, query: "remove", consistency: "eventual" })
    expect(query.refs.length).toBe(0)
  })
})
