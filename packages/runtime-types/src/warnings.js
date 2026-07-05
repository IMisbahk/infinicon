export const contextWarningCodes = [
  "empty_context",
  "truncated",
  "required_ref_omitted",
  "stale_consolidation",
  "disputed_memory_included",
  "superseded_memory_included",
  "eventual_consistency",
  "partial_hydration",
]

export function createWarning(code, message, details = {}) {
  return { code, message, details }
}
