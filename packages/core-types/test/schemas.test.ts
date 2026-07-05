import { describe, expect, test } from "bun:test"

import {
  assembleContextRequestSchema,
  contextBudgetSchema,
  ingestRequestSchema,
  memoryRefSchema,
  queryRequestSchema,
  scopeSchema,
  tombstoneRequestSchema,
} from "../src"

describe("schema ids", () => {
  test("all major schemas have stable ids", () => {
    expect(scopeSchema.$id).toBe("https://infinicon.dev/schemas/scope.json")
    expect(memoryRefSchema.$id).toBe("https://infinicon.dev/schemas/memory-ref.json")
    expect(ingestRequestSchema.$id).toBe("https://infinicon.dev/schemas/ingest-request.json")
    expect(queryRequestSchema.$id).toBe("https://infinicon.dev/schemas/query-request.json")
    expect(assembleContextRequestSchema.$id).toBe("https://infinicon.dev/schemas/assemble-context-request.json")
    expect(tombstoneRequestSchema.$id).toBe("https://infinicon.dev/schemas/tombstone-request.json")
  })
})

describe("schema invariants", () => {
  test("scope requires tenantId and namespaceId", () => {
    expect(scopeSchema.required).toContain("tenantId")
    expect(scopeSchema.required).toContain("namespaceId")
  })

  test("memory ref includes constrained type enum", () => {
    const typeField = memoryRefSchema.properties.type
    if (!("enum" in typeField)) {
      throw new Error("expected enum in memoryRefSchema type")
    }

    expect(typeField.enum).toEqual(["episode", "atom", "consolidation", "link"])
  })

  test("ingest episodes has minItems 1", () => {
    const episodes = ingestRequestSchema.properties.episodes
    if (!("minItems" in episodes)) {
      throw new Error("expected minItems in ingest episodes schema")
    }

    expect(episodes.minItems).toBe(1)
  })

  test("query limit is positive integer when provided", () => {
    const limit = queryRequestSchema.properties.limit
    if (!("minimum" in limit)) {
      throw new Error("expected minimum in query limit schema")
    }

    expect(limit.minimum).toBe(1)
  })

  test("context budget enforces maxTokens", () => {
    expect(contextBudgetSchema.required).toContain("maxTokens")
  })

  test("tombstone requires reason and cascadePolicy", () => {
    expect(tombstoneRequestSchema.required).toContain("reason")
    expect(tombstoneRequestSchema.required).toContain("cascadePolicy")
  })
})
