import type {
  AssembleContextRequest,
  IngestRequest,
  QueryRequest,
  TombstoneRequest,
} from "./api"
import type {
  ContextBudget,
  ContextConstraints,
  LifecycleStatus,
  MemoryFilters,
  MemoryRef,
  Scope,
} from "./model"

export type ValidationIssue = {
  path: string
  message: string
}

export type ValidationResult = {
  ok: boolean
  issues: ValidationIssue[]
}

const issue = (path: string, message: string): ValidationIssue => ({ path, message })
const hasText = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0
const isFinitePositiveInt = (value: number | undefined): boolean =>
  typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0

export const validateScope = (scope: Scope): ValidationResult => {
  const issues: ValidationIssue[] = []

  if (!hasText(scope.tenantId)) {
    issues.push(issue("scope.tenantId", "tenantId must be non-empty"))
  }

  if (!hasText(scope.namespaceId)) {
    issues.push(issue("scope.namespaceId", "namespaceId must be non-empty"))
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateMemoryRef = (ref: MemoryRef): ValidationResult => {
  const issues: ValidationIssue[] = []

  if (!hasText(ref.id)) {
    issues.push(issue("ref.id", "id must be non-empty"))
  }

  const scopeValidation = validateScope(ref.scope)
  for (const scopeIssue of scopeValidation.issues) {
    issues.push(issue(`ref.${scopeIssue.path}`, scopeIssue.message))
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateContextBudget = (budget: ContextBudget): ValidationResult => {
  const issues: ValidationIssue[] = []

  if (!isFinitePositiveInt(budget.maxTokens)) {
    issues.push(issue("budget.maxTokens", "maxTokens must be a positive integer"))
  }

  if (budget.maxSegments !== undefined && !isFinitePositiveInt(budget.maxSegments)) {
    issues.push(issue("budget.maxSegments", "maxSegments must be a positive integer when provided"))
  }

  if (budget.reservedTokens !== undefined && !isFinitePositiveInt(budget.reservedTokens)) {
    issues.push(issue("budget.reservedTokens", "reservedTokens must be a positive integer when provided"))
  }

  if (
    budget.reservedTokens !== undefined &&
    isFinitePositiveInt(budget.maxTokens) &&
    budget.reservedTokens >= budget.maxTokens
  ) {
    issues.push(issue("budget.reservedTokens", "reservedTokens must be less than maxTokens"))
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateMemoryFilters = (filters: MemoryFilters | undefined): ValidationResult => {
  if (!filters) {
    return { ok: true, issues: [] }
  }

  const issues: ValidationIssue[] = []

  if (filters.types && filters.types.length === 0) {
    issues.push(issue("filters.types", "types must not be an empty array"))
  }

  if (filters.statuses && filters.statuses.length === 0) {
    issues.push(issue("filters.statuses", "statuses must not be an empty array"))
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateContextConstraints = (constraints: ContextConstraints | undefined): ValidationResult => {
  if (!constraints) {
    return { ok: true, issues: [] }
  }

  const issues: ValidationIssue[] = []

  if (constraints.maxSegments !== undefined && !isFinitePositiveInt(constraints.maxSegments)) {
    issues.push(issue("constraints.maxSegments", "maxSegments must be a positive integer when provided"))
  }

  if (constraints.mustIncludeRefs) {
    constraints.mustIncludeRefs.forEach((ref, index) => {
      const result = validateMemoryRef(ref)
      for (const refIssue of result.issues) {
        issues.push(issue(`constraints.mustIncludeRefs[${index}].${refIssue.path}`, refIssue.message))
      }
    })
  }

  if (constraints.excludedRefs) {
    constraints.excludedRefs.forEach((ref, index) => {
      const result = validateMemoryRef(ref)
      for (const refIssue of result.issues) {
        issues.push(issue(`constraints.excludedRefs[${index}].${refIssue.path}`, refIssue.message))
      }
    })
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

const mergeResults = (...results: ValidationResult[]): ValidationResult => {
  const issues = results.flatMap((result) => result.issues)
  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateIngestRequest = (request: IngestRequest): ValidationResult => {
  const issues: ValidationIssue[] = []

  const scope = validateScope(request.scope)
  issues.push(...scope.issues)

  if (request.episodes.length === 0) {
    issues.push(issue("episodes", "episodes must contain at least one episode"))
  }

  request.episodes.forEach((episode, index) => {
    if (!hasText(episode.contentType)) {
      issues.push(issue(`episodes[${index}].contentType`, "contentType must be non-empty"))
    }

    if (!hasText(episode.createdBy)) {
      issues.push(issue(`episodes[${index}].createdBy`, "createdBy must be non-empty"))
    }

    if (episode.dedupeKey !== undefined && !hasText(episode.dedupeKey)) {
      issues.push(issue(`episodes[${index}].dedupeKey`, "dedupeKey must be non-empty when provided"))
    }
  })

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateQueryRequest = (request: QueryRequest): ValidationResult => {
  const scope = validateScope(request.scope)
  const filterValidation = validateMemoryFilters(request.filters)
  const issues = [...scope.issues, ...filterValidation.issues]

  if (!hasText(request.query)) {
    issues.push(issue("query", "query must be non-empty"))
  }

  if (request.limit !== undefined && !isFinitePositiveInt(request.limit)) {
    issues.push(issue("limit", "limit must be a positive integer when provided"))
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const validateAssembleContextRequest = (request: AssembleContextRequest): ValidationResult => {
  const scope = validateScope(request.scope)
  const budget = validateContextBudget(request.budget)
  const filters = validateMemoryFilters(request.filters)
  const constraints = validateContextConstraints(request.constraints)

  const merged = mergeResults(scope, budget, filters, constraints)

  if (!hasText(request.task)) {
    merged.issues.push(issue("task", "task must be non-empty"))
  }

  return {
    ok: merged.issues.length === 0,
    issues: merged.issues,
  }
}

export const validateTombstoneRequest = (request: TombstoneRequest): ValidationResult => {
  const issues: ValidationIssue[] = []

  const scope = validateScope(request.scope)
  issues.push(...scope.issues)

  if (request.refs.length === 0) {
    issues.push(issue("refs", "refs must contain at least one memory ref"))
  }

  request.refs.forEach((ref, index) => {
    const validation = validateMemoryRef(ref)
    for (const refIssue of validation.issues) {
      issues.push(issue(`refs[${index}].${refIssue.path}`, refIssue.message))
    }

    if (ref.scope.tenantId !== request.scope.tenantId || ref.scope.namespaceId !== request.scope.namespaceId) {
      // shit this prevents accidental cross-namespace tombstones
      issues.push(issue(`refs[${index}]`, "memory ref scope must match request scope"))
    }
  })

  if (!hasText(request.reason)) {
    issues.push(issue("reason", "reason must be non-empty"))
  }

  return {
    ok: issues.length === 0,
    issues,
  }
}

export const isRetrievableStatus = (status: LifecycleStatus): boolean => status === "active"
