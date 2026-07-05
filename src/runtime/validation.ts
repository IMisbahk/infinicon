import { errors } from "./errors"
import type { Scope } from "./types"

export const assertScope = (scope: Scope): void => {
  if (!scope.tenantId || !scope.namespaceId) throw errors.invalidScope()
}
