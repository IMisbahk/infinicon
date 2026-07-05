import { describe, expect, test } from "bun:test"
import {
  ValidationError,
  validateAssembleContextRequest,
  validateGetJobRequest,
  validateHydrateRequest,
  validateIngestRequest,
  validateQueryRequest,
  validateTombstoneRequest,
} from "../src/domain/validation"

const scope = {
  tenantId: "tenant-acme",
  namespaceId: "ns-support",
}

describe("domain request validation", () => {
  test("accepts a valid ingest request", () => {
    const request = {
      scope,
      episodes: [
        {
          contentType: "application/json",
          content: { role: "user", text: "hello" },
          dedupeKey: "k1",
          createdBy: { id: "agent-1", kind: "agent" },
          metadata: {},
        },
      ],
    }

    expect(validateIngestRequest(request)).toEqual(request)
  })

  test("rejects ingest request without episodes", () => {
    expect(() => validateIngestRequest({ scope, episodes: [] })).toThrow(ValidationError)
  })

  test("accepts valid query and hydrate requests", () => {
    expect(
      validateQueryRequest({
        scope,
        query: "how to build",
        limit: 3,
      }),
    ).toBeDefined()

    expect(
      validateHydrateRequest({
        scope,
        refs: [{ id: "ep1", type: "episode", scope }],
      }),
    ).toBeDefined()
  })

  test("accepts assembleContext and tombstone requests", () => {
    expect(
      validateAssembleContextRequest({
        scope,
        task: "help with compile error",
        budget: { maxTokens: 1200 },
      }),
    ).toBeDefined()

    expect(
      validateTombstoneRequest({
        scope,
        refs: [{ id: "ep1", type: "episode", scope }],
        reason: "user requested deletion",
        cascadePolicy: "none",
      }),
    ).toBeDefined()
  })

  test("rejects getJob request missing jobId", () => {
    expect(() => validateGetJobRequest({ scope })).toThrow(ValidationError)
  })
})
