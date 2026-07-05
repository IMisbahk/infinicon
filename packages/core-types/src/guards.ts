import type { MemoryRef, Scope } from "./model"

const hasText = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0

export const hasRequiredScope = (scope: Scope): boolean => hasText(scope.tenantId) && hasText(scope.namespaceId)

export const assertScope = (scope: Scope): void => {
  if (!hasRequiredScope(scope)) {
    throw new Error("scope must include non-empty tenantId and namespaceId")
  }
}

export const assertMemoryRefInScope = (ref: MemoryRef, scope: Scope): void => {
  assertScope(scope)
  assertScope(ref.scope)
  if (ref.scope.tenantId !== scope.tenantId || ref.scope.namespaceId !== scope.namespaceId) {
    // damn this should fail loud to avoid cross-scope leaks
    throw new Error("memory ref scope does not match request scope")
  }
}
