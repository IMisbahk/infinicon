import { describe, expect, test } from "bun:test"
import { validateAssembleContext, validateIngest, validateTombstone } from "../src/core/validation"

describe("validation", () => {
  test("validateIngest rejects empty episodes", () => {
    expect(() =>
      validateIngest({
        scope: {
          tenantId: "t1",
          namespaceId: "n1",
        },
        episodes: [],
      }),
    ).toThrow("episodes must be a non-empty array")
  })

  test("validateAssembleContext rejects negative budget", () => {
    expect(() =>
      validateAssembleContext({
        scope: {
          tenantId: "t1",
          namespaceId: "n1",
        },
        task: "task",
        budget: {
          maxTokens: -1,
        },
      }),
    ).toThrow("budget.maxTokens")
  })

  test("validateTombstone rejects invalid policy", () => {
    expect(() =>
      validateTombstone({
        scope: {
          tenantId: "t1",
          namespaceId: "n1",
        },
        refs: [
          {
            id: "ep1",
            type: "episode",
            scope: {
              tenantId: "t1",
              namespaceId: "n1",
            },
          },
        ],
        reason: "x",
        cascadePolicy: "bad-policy" as unknown as "none",
      }),
    ).toThrow("cascadePolicy")
  })
})
