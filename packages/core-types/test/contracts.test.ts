import { describe, expect, test } from "bun:test"

import {
  assertMemoryRefInScope,
  assertScope,
  type AssembleContextRequest,
  type Consolidation,
  type IngestRequest,
  type Link,
  type MemoryApiContract,
  type MemoryRef,
  type Scope,
  type WorkingContext,
  includeStatus,
} from "../src"

const scope: Scope = {
  tenantId: "tenant-acme",
  namespaceId: "ns-primary",
}

const ref = (id: string, type: MemoryRef["type"]): MemoryRef => ({
  id,
  type,
  scope,
})

describe("scope guards", () => {
  test("accepts valid scope", () => {
    expect(() => assertScope(scope)).not.toThrow()
  })

  test("rejects empty scope ids", () => {
    expect(() => assertScope({ tenantId: "", namespaceId: "ns" })).toThrow(
      "scope must include non-empty tenantId and namespaceId",
    )
  })

  test("rejects cross-scope refs", () => {
    const foreignRef: MemoryRef = {
      id: "ep-1",
      type: "episode",
      scope: {
        tenantId: "tenant-other",
        namespaceId: "ns-primary",
      },
    }

    expect(() => assertMemoryRefInScope(foreignRef, scope)).toThrow(
      "memory ref scope does not match request scope",
    )
  })
})

describe("lifecycle helper", () => {
  test("includes active by default", () => {
    expect(includeStatus("active")).toBe(true)
  })

  test("excludes tombstoned by default", () => {
    expect(includeStatus("tombstoned")).toBe(false)
  })
})

describe("spec-aligned shape checks", () => {
  test("supports ingest consistency modes", () => {
    const ingest: IngestRequest = {
      scope,
      consistency: "indexed",
      episodes: [
        {
          contentType: "text/plain",
          content: "hello",
          dedupeKey: "ep-1",
          createdBy: "agent:test",
        },
      ],
    }

    expect(ingest.consistency).toBe("indexed")
    expect(ingest.episodes[0]?.dedupeKey).toBe("ep-1")
  })

  test("enforces consolidation provenance linkage", () => {
    const c: Consolidation = {
      id: "c-1",
      type: "consolidation",
      scope,
      createdAt: new Date().toISOString(),
      createdBy: { id: "plugin:consolidator", kind: "plugin" },
      status: "active",
      metadata: {},
      content: "summary",
      sourceRefs: [ref("ep-1", "episode")],
      provenance: {
        sourceRefs: [ref("ep-1", "episode")],
        producedBy: { id: "plugin:consolidator", kind: "plugin" },
        createdAt: new Date().toISOString(),
        transformation: "consolidate",
      },
    }

    expect(c.provenance.sourceRefs[0]?.id).toBe("ep-1")
  })

  test("supports core link types", () => {
    const link: Link = {
      id: "l-1",
      type: "link",
      scope,
      createdAt: new Date().toISOString(),
      createdBy: { id: "plugin:extractor", kind: "plugin" },
      status: "active",
      metadata: {},
      linkType: "contradicts",
      from: ref("a-1", "atom"),
      to: ref("a-2", "atom"),
    }

    expect(link.linkType).toBe("contradicts")
  })

  test("represents empty working context explicitly", () => {
    const empty: WorkingContext = {
      scope,
      task: "answer support question",
      budget: { maxTokens: 1024 },
      segments: [],
      tokenEstimate: 0,
      truncated: false,
      warnings: [{ code: "empty_context", message: "no memory matched" }],
      generatedAt: new Date().toISOString(),
    }

    expect(empty.segments).toHaveLength(0)
    expect(empty.warnings[0]?.code).toBe("empty_context")
  })

  test("assembles context with consistency preference", () => {
    const req: AssembleContextRequest = {
      scope,
      task: "prepare coding context",
      budget: { maxTokens: 4000, reservedTokens: 500 },
      consistency: "strong",
      constraints: {
        includeDisputed: false,
        includeSuperseded: false,
      },
    }

    expect(req.consistency).toBe("strong")
    expect(req.budget.reservedTokens).toBe(500)
  })
})

describe("contract compiles as callable interface", () => {
  test("memory api interface can be implemented", async () => {
    const api: MemoryApiContract = {
      async ingest() {
        return { results: [] }
      },
      async query() {
        return { refs: [] }
      },
      async hydrate() {
        return { objects: [], missing: [] }
      },
      async assembleContext() {
        return {
          context: {
            scope,
            task: "t",
            budget: { maxTokens: 100 },
            segments: [],
            tokenEstimate: 0,
            truncated: false,
            warnings: [],
            generatedAt: new Date().toISOString(),
          },
        }
      },
      async consolidate() {
        return { jobId: "job-1", status: "queued" }
      },
      async tombstone() {
        return { results: [] }
      },
      async *subscribe() {
        yield {
          type: "episode.ingested",
          scope,
          timestamp: new Date().toISOString(),
        }
      },
      async getJob() {
        return {
          jobId: "job-1",
          type: "consolidation",
          status: "queued",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
    }

    const response = await api.query({ scope, query: "hello" })
    expect(response.refs).toHaveLength(0)
  })
})
