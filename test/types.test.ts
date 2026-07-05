import { describe, expect, test } from "bun:test"
import type { ContextWarningCode, MemoryEventType, TombstoneCascadePolicy } from "../src"

describe("SDK exported unions", () => {
  test("includes expected tombstone policies", () => {
    const policies: TombstoneCascadePolicy[] = [
      "none",
      "mark_derived_stale",
      "tombstone_derived",
    ]

    expect(policies).toHaveLength(3)
  })

  test("includes expected context warning codes", () => {
    const warningCodes: ContextWarningCode[] = [
      "empty_context",
      "truncated",
      "required_ref_omitted",
      "stale_consolidation",
      "disputed_memory_included",
      "superseded_memory_included",
      "eventual_consistency",
      "partial_hydration",
    ]

    expect(warningCodes).toContain("partial_hydration")
  })

  test("includes expected event types", () => {
    const eventTypes: MemoryEventType[] = [
      "episode.ingested",
      "atom.extracted",
      "memory.indexed",
      "consolidation.started",
      "consolidation.completed",
      "consolidation.failed",
      "memory.disputed",
      "memory.superseded",
      "memory.tombstoned",
    ]

    expect(eventTypes[eventTypes.length - 1]).toBe("memory.tombstoned")
  })
})
