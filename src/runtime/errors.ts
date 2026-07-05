import type { MemoryApiError } from "./types"

export class RuntimeError extends Error {
  public readonly code: string
  public readonly retryable: boolean
  public readonly details?: Record<string, unknown>

  constructor(input: MemoryApiError) {
    super(input.message)
    this.name = "RuntimeError"
    this.code = input.code
    this.retryable = input.retryable
    this.details = input.details
  }

  toMemoryApiError(): MemoryApiError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
    }
  }
}

export const errors = {
  invalidScope: (): RuntimeError =>
    new RuntimeError({
      code: "invalid_scope",
      message: "scope must include tenantId and namespaceId",
      retryable: false,
    }),
  unsupportedStrongConsistency: (): RuntimeError =>
    new RuntimeError({
      code: "unsupported_consistency",
      message: "strong consistency is not supported by configured adapters",
      retryable: false,
    }),
  dedupeConflict: (dedupeKey: string): RuntimeError =>
    new RuntimeError({
      code: "dedupe_conflict",
      message: `dedupe key conflict for ${dedupeKey}`,
      retryable: false,
    }),
  notFound: (id: string): RuntimeError =>
    new RuntimeError({
      code: "not_found",
      message: `memory object not found: ${id}`,
      retryable: false,
    }),
}
