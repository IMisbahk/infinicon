import { describe, expect, test } from "bun:test"

import {
  normalizeContextBudget,
  normalizeMemoryFilters,
  validateAssembleContextRequest,
  validateIngestRequest,
  validateMemoryRef,
  validateQueryRequest,
  validateScope,
  validateTombstoneRequest,
} from "../src"

describe("scope validation", () => {
  test("valid scope passes", () => {
    const result = validateScope({ tenantId: "tenant", namespaceId: "ns" })
    expect(result.ok).toBe(true)
  })

  test("invalid scope fails", () => {
    const result = validateScope({ tenantId: "", namespaceId: "" })
    expect(result.ok).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })
})

describe("memory ref validation", () => {
  test("invalid ref id fails", () => {
    const result = validateMemoryRef({
      id: "",
      type: "atom",
      scope: { tenantId: "tenant", namespaceId: "ns" },
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((x) => x.path)).toContain("ref.id")
  })
})

describe("request validation", () => {
  test("ingest requires at least one episode", () => {
    const result = validateIngestRequest({
      scope: { tenantId: "tenant", namespaceId: "ns" },
      episodes: [],
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((x) => x.path)).toContain("episodes")
  })

  test("query rejects empty query", () => {
    const result = validateQueryRequest({
      scope: { tenantId: "tenant", namespaceId: "ns" },
      query: "",
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((x) => x.path)).toContain("query")
  })

  test("assemble context validates budget and task", () => {
    const result = validateAssembleContextRequest({
      scope: { tenantId: "tenant", namespaceId: "ns" },
      task: "",
      budget: { maxTokens: 100, reservedTokens: 100 },
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((x) => x.path)).toContain("task")
    expect(result.issues.map((x) => x.path)).toContain("budget.reservedTokens")
  })

  test("tombstone rejects cross-scope refs", () => {
    const result = validateTombstoneRequest({
      scope: { tenantId: "tenant", namespaceId: "ns" },
      refs: [
        {
          id: "ep-1",
          type: "episode",
          scope: { tenantId: "other", namespaceId: "ns" },
        },
      ],
      reason: "privacy request",
      cascadePolicy: "tombstone_derived",
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((x) => x.message)).toContain("memory ref scope must match request scope")
  })
})

describe("normalizers", () => {
  test("dedupes filter arrays", () => {
    const normalized = normalizeMemoryFilters({
      types: ["episode", "episode", "atom"],
      statuses: ["active", "active"],
    })

    expect(normalized?.types).toEqual(["episode", "atom"])
    expect(normalized?.statuses).toEqual(["active"])
  })

  test("truncates budget numeric fields", () => {
    const normalized = normalizeContextBudget({
      maxTokens: 1000.9,
      maxSegments: 5.6,
      reservedTokens: 100.7,
    })

    expect(normalized.maxTokens).toBe(1000)
    expect(normalized.maxSegments).toBe(5)
    expect(normalized.reservedTokens).toBe(100)
  })
})
