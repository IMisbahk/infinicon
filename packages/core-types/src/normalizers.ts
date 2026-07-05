import type { ContextBudget, ContextConstraints, MemoryFilters } from "./model"

const dedupeSorted = <T>(values: T[] | undefined): T[] | undefined => {
  if (!values) {
    return undefined
  }

  return [...new Set(values)]
}

export const normalizeMemoryFilters = (filters: MemoryFilters | undefined): MemoryFilters | undefined => {
  if (!filters) {
    return undefined
  }

  return {
    ...filters,
    types: dedupeSorted(filters.types),
    statuses: dedupeSorted(filters.statuses),
  }
}

export const normalizeContextBudget = (budget: ContextBudget): ContextBudget => {
  const normalized: ContextBudget = {
    ...budget,
    maxTokens: Math.trunc(budget.maxTokens),
  }

  if (budget.maxSegments !== undefined) {
    normalized.maxSegments = Math.trunc(budget.maxSegments)
  }

  if (budget.reservedTokens !== undefined) {
    normalized.reservedTokens = Math.trunc(budget.reservedTokens)
  }

  return normalized
}

export const normalizeContextConstraints = (constraints: ContextConstraints | undefined): ContextConstraints | undefined => {
  if (!constraints) {
    return undefined
  }

  return {
    ...constraints,
    maxSegments: constraints.maxSegments !== undefined ? Math.trunc(constraints.maxSegments) : undefined,
  }
}
