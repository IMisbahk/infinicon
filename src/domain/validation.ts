import type {
  AssembleContextRequest,
  ConsolidateRequest,
  GetJobRequest,
  HydrateRequest,
  IngestRequest,
  QueryRequest,
  Scope,
  SubscribeRequest,
  TombstoneRequest,
} from "./types"

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const isString = (value: unknown): value is string => {
  return typeof value === "string" && value.length > 0
}

const assertScope = (scope: unknown): asserts scope is Scope => {
  if (!isObject(scope)) {
    throw new ValidationError("scope must be an object")
  }
  if (!isString(scope.tenantId)) {
    throw new ValidationError("scope.tenantId is required")
  }
  if (!isString(scope.namespaceId)) {
    throw new ValidationError("scope.namespaceId is required")
  }
}

export const validateIngestRequest = (request: unknown): IngestRequest => {
  if (!isObject(request)) {
    throw new ValidationError("ingest request must be an object")
  }
  assertScope(request.scope)
  if (!Array.isArray(request.episodes) || request.episodes.length === 0) {
    throw new ValidationError("episodes must be a non-empty array")
  }

  for (const episode of request.episodes) {
    if (!isObject(episode)) {
      throw new ValidationError("episode must be an object")
    }
    if (!isString(episode.contentType)) {
      throw new ValidationError("episode.contentType is required")
    }
    if (!isString(episode.dedupeKey)) {
      throw new ValidationError("episode.dedupeKey is required")
    }
    if (!isObject(episode.createdBy) || !isString(episode.createdBy.id) || !isString(episode.createdBy.kind)) {
      throw new ValidationError("episode.createdBy.id and kind are required")
    }
    if (!isObject(episode.metadata)) {
      throw new ValidationError("episode.metadata must be an object")
    }
  }

  return request as IngestRequest
}

export const validateQueryRequest = (request: unknown): QueryRequest => {
  if (!isObject(request)) {
    throw new ValidationError("query request must be an object")
  }
  assertScope(request.scope)
  if (!isString(request.query)) {
    throw new ValidationError("query is required")
  }
  if (request.limit !== undefined && (typeof request.limit !== "number" || request.limit < 1)) {
    throw new ValidationError("limit must be >= 1")
  }
  return request as QueryRequest
}

export const validateHydrateRequest = (request: unknown): HydrateRequest => {
  if (!isObject(request)) {
    throw new ValidationError("hydrate request must be an object")
  }
  assertScope(request.scope)
  if (!Array.isArray(request.refs) || request.refs.length === 0) {
    throw new ValidationError("refs must be a non-empty array")
  }
  return request as HydrateRequest
}

export const validateAssembleContextRequest = (request: unknown): AssembleContextRequest => {
  if (!isObject(request)) {
    throw new ValidationError("assembleContext request must be an object")
  }
  assertScope(request.scope)
  if (!isString(request.task)) {
    throw new ValidationError("task is required")
  }
  if (!isObject(request.budget) || typeof request.budget.maxTokens !== "number" || request.budget.maxTokens < 1) {
    throw new ValidationError("budget.maxTokens must be >= 1")
  }
  return request as AssembleContextRequest
}

export const validateConsolidateRequest = (request: unknown): ConsolidateRequest => {
  if (!isObject(request)) {
    throw new ValidationError("consolidate request must be an object")
  }
  assertScope(request.scope)
  if (!isString(request.trigger)) {
    throw new ValidationError("trigger is required")
  }
  return request as ConsolidateRequest
}

export const validateTombstoneRequest = (request: unknown): TombstoneRequest => {
  if (!isObject(request)) {
    throw new ValidationError("tombstone request must be an object")
  }
  assertScope(request.scope)
  if (!Array.isArray(request.refs) || request.refs.length === 0) {
    throw new ValidationError("refs must be a non-empty array")
  }
  if (!isString(request.reason)) {
    throw new ValidationError("reason is required")
  }
  if (!isString(request.cascadePolicy)) {
    throw new ValidationError("cascadePolicy is required")
  }
  return request as TombstoneRequest
}

export const validateSubscribeRequest = (request: unknown): SubscribeRequest => {
  if (!isObject(request)) {
    throw new ValidationError("subscribe request must be an object")
  }
  assertScope(request.scope)
  return request as SubscribeRequest
}

export const validateGetJobRequest = (request: unknown): GetJobRequest => {
  if (!isObject(request)) {
    throw new ValidationError("getJob request must be an object")
  }
  assertScope(request.scope)
  if (!isString(request.jobId)) {
    throw new ValidationError("jobId is required")
  }
  return request as GetJobRequest
}
