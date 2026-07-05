import type {
  AssembleContextRequest,
  AssembleContextResponse,
  HydrateRequest,
  HydrateResponse,
  QueryRequest,
  QueryResponse,
  TombstoneRequest,
} from "./api"
import type { ContextWarningCode, LifecycleStatus, MemoryRef, WorkingContext } from "./model"

type ConformanceIssue = {
  code: string
  message: string
}

export class ConformanceError extends Error {
  readonly issues: ConformanceIssue[]

  constructor(message: string, issues: ConformanceIssue[]) {
    super(message)
    this.name = "ConformanceError"
    this.issues = issues
  }
}

const conformanceFail = (message: string, issues: ConformanceIssue[]): never => {
  throw new ConformanceError(message, issues)
}

const memoryRefKey = (ref: MemoryRef): string => `${ref.scope.tenantId}/${ref.scope.namespaceId}/${ref.type}/${ref.id}`

const warningSet = (context: WorkingContext): Set<string> =>
  new Set(context.warnings.map((warning) => `${warning.code}`.trim()))

const findMissingRefs = (required: MemoryRef[] | undefined, actual: MemoryRef[]): MemoryRef[] => {
  if (!required || required.length === 0) {
    return []
  }

  const actualKeys = new Set(actual.map(memoryRefKey))
  return required.filter((ref) => !actualKeys.has(memoryRefKey(ref)))
}

const ensureNonNegativeInteger = (value: number, path: string, issues: ConformanceIssue[]): void => {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    issues.push({ code: "invalid_numeric", message: `${path} must be a non-negative integer` })
  }
}

export const assertQueryConformance = (request: QueryRequest, response: QueryResponse): void => {
  const issues: ConformanceIssue[] = []

  if (request.limit !== undefined && response.refs.length > request.limit) {
    issues.push({
      code: "limit_exceeded",
      message: `query returned ${response.refs.length} refs but limit is ${request.limit}`,
    })
  }

  for (const entry of response.refs) {
    if (entry.ref.scope.tenantId !== request.scope.tenantId || entry.ref.scope.namespaceId !== request.scope.namespaceId) {
      issues.push({
        code: "scope_mismatch",
        message: "query returned memory ref from a different scope",
      })
    }
  }

  if (issues.length > 0) {
    conformanceFail("query response failed conformance", issues)
  }
}

export const assertHydrateConformance = (request: HydrateRequest, response: HydrateResponse): void => {
  const issues: ConformanceIssue[] = []
  const requested = new Set(request.refs.map(memoryRefKey))

  for (const object of response.objects) {
    const key = memoryRefKey({ id: object.id, type: object.type, scope: object.scope })
    if (!requested.has(key)) {
      issues.push({
        code: "unexpected_object",
        message: "hydrate returned object not present in request refs",
      })
    }

    if (object.scope.tenantId !== request.scope.tenantId || object.scope.namespaceId !== request.scope.namespaceId) {
      issues.push({
        code: "scope_mismatch",
        message: "hydrate returned object from a different scope",
      })
    }
  }

  for (const missing of response.missing) {
    const key = memoryRefKey(missing)
    if (!requested.has(key)) {
      issues.push({
        code: "unexpected_missing",
        message: "hydrate missing list contains ref not present in request",
      })
    }
  }

  if (issues.length > 0) {
    conformanceFail("hydrate response failed conformance", issues)
  }
}

export const assertContextConformance = (
  request: AssembleContextRequest,
  response: AssembleContextResponse,
  options?: {
    allowStatus?: LifecycleStatus[]
  },
): void => {
  const issues: ConformanceIssue[] = []
  const context = response.context

  if (context.scope.tenantId !== request.scope.tenantId || context.scope.namespaceId !== request.scope.namespaceId) {
    issues.push({ code: "scope_mismatch", message: "context scope does not match request scope" })
  }

  if (context.task !== request.task) {
    issues.push({ code: "task_mismatch", message: "context task does not match request task" })
  }

  ensureNonNegativeInteger(context.tokenEstimate, "context.tokenEstimate", issues)

  if (request.budget.maxSegments !== undefined && context.segments.length > request.budget.maxSegments) {
    issues.push({
      code: "segment_budget_exceeded",
      message: `context returned ${context.segments.length} segments but maxSegments is ${request.budget.maxSegments}`,
    })
  }

  const requiredMissing = findMissingRefs(request.constraints?.mustIncludeRefs, context.segments.map((segment) => segment.ref))
  const warnings = warningSet(context)

  if (requiredMissing.length > 0 && !warnings.has("required_ref_omitted")) {
    issues.push({
      code: "missing_warning",
      message: "required refs were omitted but required_ref_omitted warning was not present",
    })
  }

  if (context.segments.length === 0 && !warnings.has("empty_context")) {
    issues.push({
      code: "missing_warning",
      message: "empty context must include empty_context warning",
    })
  }

  if (context.truncated && !warnings.has("truncated")) {
    issues.push({
      code: "missing_warning",
      message: "truncated context must include truncated warning",
    })
  }

  const allowedStatuses = new Set(options?.allowStatus ?? ["active"])
  for (const segment of context.segments) {
    if (segment.ref.scope.tenantId !== request.scope.tenantId || segment.ref.scope.namespaceId !== request.scope.namespaceId) {
      issues.push({ code: "scope_mismatch", message: "context segment ref has different scope" })
    }

    const status = (segment.provenance?.metadata?.status as ContextWarningCode | undefined) ?? undefined
    if (status && !allowedStatuses.has(status as unknown as LifecycleStatus)) {
      issues.push({
        code: "status_not_allowed",
        message: `segment contains status ${status} that is not allowed by conformance check`,
      })
    }
  }

  if (issues.length > 0) {
    conformanceFail("context response failed conformance", issues)
  }
}

export const assertTombstoneConformance = (request: TombstoneRequest, affected: MemoryRef[]): void => {
  const issues: ConformanceIssue[] = []

  for (const ref of affected) {
    if (ref.scope.tenantId !== request.scope.tenantId || ref.scope.namespaceId !== request.scope.namespaceId) {
      issues.push({
        code: "scope_mismatch",
        message: "tombstone result includes affected ref from different scope",
      })
    }
  }

  if (issues.length > 0) {
    conformanceFail("tombstone result failed conformance", issues)
  }
}
