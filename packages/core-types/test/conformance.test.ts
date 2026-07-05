import { describe, expect, test } from "bun:test"

import {
  ConformanceError,
  assertContextConformance,
  assertHydrateConformance,
  assertQueryConformance,
  assertTombstoneConformance,
  type AssembleContextRequest,
  type AssembleContextResponse,
  type HydrateRequest,
  type HydrateResponse,
  type QueryRequest,
  type QueryResponse,
  type Scope,
  type TombstoneRequest,
} from "../src"

const scope: Scope = {
  tenantId: "tenant",
  namespaceId: "ns",
}

describe("query conformance", () => {
  test("passes for scoped, bounded result", () => {
    const request: QueryRequest = {
      scope,
      query: "hello",
      limit: 2,
    }

    const response: QueryResponse = {
      refs: [
        {
          ref: { id: "ep-1", type: "episode", scope },
          score: 0.9,
        },
      ],
    }

    expect(() => assertQueryConformance(request, response)).not.toThrow()
  })

  test("fails when result exceeds limit", () => {
    const request: QueryRequest = {
      scope,
      query: "hello",
      limit: 1,
    }

    const response: QueryResponse = {
      refs: [
        { ref: { id: "ep-1", type: "episode", scope }, score: 0.9 },
        { ref: { id: "ep-2", type: "episode", scope }, score: 0.8 },
      ],
    }

    expect(() => assertQueryConformance(request, response)).toThrow(ConformanceError)
  })
})

describe("hydrate conformance", () => {
  test("passes for requested refs only", () => {
    const request: HydrateRequest = {
      scope,
      refs: [{ id: "ep-1", type: "episode", scope }],
    }

    const response: HydrateResponse = {
      objects: [
        {
          id: "ep-1",
          type: "episode",
          scope,
          createdAt: new Date().toISOString(),
          createdBy: { id: "agent", kind: "agent" },
          status: "active",
          metadata: {},
          contentType: "text/plain",
          content: "x",
        },
      ],
      missing: [],
    }

    expect(() => assertHydrateConformance(request, response)).not.toThrow()
  })

  test("fails for unexpected object", () => {
    const request: HydrateRequest = {
      scope,
      refs: [{ id: "ep-1", type: "episode", scope }],
    }

    const response: HydrateResponse = {
      objects: [
        {
          id: "ep-2",
          type: "episode",
          scope,
          createdAt: new Date().toISOString(),
          createdBy: { id: "agent", kind: "agent" },
          status: "active",
          metadata: {},
          contentType: "text/plain",
          content: "x",
        },
      ],
      missing: [],
    }

    expect(() => assertHydrateConformance(request, response)).toThrow(ConformanceError)
  })
})

describe("context conformance", () => {
  const request: AssembleContextRequest = {
    scope,
    task: "prepare context",
    budget: { maxTokens: 1000, maxSegments: 2 },
  }

  test("passes for empty context with warning", () => {
    const response: AssembleContextResponse = {
      context: {
        scope,
        task: "prepare context",
        budget: { maxTokens: 1000 },
        segments: [],
        tokenEstimate: 0,
        truncated: false,
        warnings: [{ code: "empty_context", message: "none" }],
        generatedAt: new Date().toISOString(),
      },
    }

    expect(() => assertContextConformance(request, response)).not.toThrow()
  })

  test("fails when truncated warning is missing", () => {
    const response: AssembleContextResponse = {
      context: {
        scope,
        task: "prepare context",
        budget: { maxTokens: 1000 },
        segments: [
          {
            ref: { id: "ep-1", type: "episode", scope },
            content: "data",
            score: 1,
          },
        ],
        tokenEstimate: 10,
        truncated: true,
        warnings: [],
        generatedAt: new Date().toISOString(),
      },
    }

    expect(() => assertContextConformance(request, response)).toThrow(ConformanceError)
  })
})

describe("tombstone conformance", () => {
  test("passes for same-scope affected refs", () => {
    const request: TombstoneRequest = {
      scope,
      refs: [{ id: "ep-1", type: "episode", scope }],
      reason: "privacy",
      cascadePolicy: "none",
    }

    expect(() =>
      assertTombstoneConformance(request, [
        {
          id: "a-1",
          type: "atom",
          scope,
        },
      ]),
    ).not.toThrow()
  })

  test("fails for cross-scope affected refs", () => {
    const request: TombstoneRequest = {
      scope,
      refs: [{ id: "ep-1", type: "episode", scope }],
      reason: "privacy",
      cascadePolicy: "none",
    }

    expect(() =>
      assertTombstoneConformance(request, [
        {
          id: "a-1",
          type: "atom",
          scope: { tenantId: "other", namespaceId: "ns" },
        },
      ]),
    ).toThrow(ConformanceError)
  })
})
