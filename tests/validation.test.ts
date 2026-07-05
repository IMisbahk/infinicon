import { describe, expect, test } from "bun:test"
import { validateAssembleContext, validateIngest, validateTombstone } from "../src/runtime/validation"

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
    ).toThrow("episodes must contain at least one episode")
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

  test("validateTombstone rejects empty refs", () => {
    expect(() =>
      validateTombstone({
        scope: {
          tenantId: "t1",
          namespaceId: "n1",
        },
        refs: [],
        reason: "x",
        cascadePolicy: "none",
      }),
    ).toThrow("refs must contain at least one memory ref")
  })
})
