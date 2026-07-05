export const jsonSchemaVersion = "https://json-schema.org/draft/2020-12/schema"

export const scopeSchema = {
  $schema: jsonSchemaVersion,
  $id: "https://infinicon.dev/schemas/scope.json",
  type: "object",
  additionalProperties: false,
  required: ["tenantId", "namespaceId"],
  properties: {
    tenantId: { type: "string", minLength: 1 },
    namespaceId: { type: "string", minLength: 1 },
    agentId: { type: "string", minLength: 1 },
    sessionId: { type: "string", minLength: 1 },
    filters: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const

export const memoryRefSchema = {
  $schema: jsonSchemaVersion,
  $id: "https://infinicon.dev/schemas/memory-ref.json",
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "scope"],
  properties: {
    id: { type: "string", minLength: 1 },
    type: {
      type: "string",
      enum: ["episode", "atom", "consolidation", "link"],
    },
    scope: scopeSchema,
  },
} as const

export const contextBudgetSchema = {
  $schema: jsonSchemaVersion,
  $id: "https://infinicon.dev/schemas/context-budget.json",
  type: "object",
  additionalProperties: false,
  required: ["maxTokens"],
  properties: {
    maxTokens: { type: "integer", minimum: 1 },
    maxSegments: { type: "integer", minimum: 1 },
    reservedTokens: { type: "integer", minimum: 1 },
    tokenizer: { type: "string", minLength: 1 },
  },
} as const

export const ingestRequestSchema = {
  $schema: jsonSchemaVersion,
  $id: "https://infinicon.dev/schemas/ingest-request.json",
  type: "object",
  additionalProperties: false,
  required: ["scope", "episodes"],
  properties: {
    scope: scopeSchema,
    consistency: {
      type: "string",
      enum: ["accepted", "indexed"],
    },
    episodes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["contentType", "content", "createdBy"],
        properties: {
          contentType: { type: "string", minLength: 1 },
          content: {},
          dedupeKey: { type: "string", minLength: 1 },
          createdBy: { type: "string", minLength: 1 },
          metadata: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
  },
} as const

export const queryRequestSchema = {
  $schema: jsonSchemaVersion,
  $id: "https://infinicon.dev/schemas/query-request.json",
  type: "object",
  additionalProperties: false,
  required: ["scope", "query"],
  properties: {
    scope: scopeSchema,
    query: { type: "string", minLength: 1 },
    limit: { type: "integer", minimum: 1 },
    consistency: {
      type: "string",
      enum: ["strong", "eventual"],
    },
    filters: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const

export const assembleContextRequestSchema = {
  $schema: jsonSchemaVersion,
  $id: "https://infinicon.dev/schemas/assemble-context-request.json",
  type: "object",
  additionalProperties: false,
  required: ["scope", "task", "budget"],
  properties: {
    scope: scopeSchema,
    task: { type: "string", minLength: 1 },
    budget: contextBudgetSchema,
    consistency: {
      type: "string",
      enum: ["strong", "eventual"],
    },
    filters: {
      type: "object",
      additionalProperties: true,
    },
    constraints: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const

export const tombstoneRequestSchema = {
  $schema: jsonSchemaVersion,
  $id: "https://infinicon.dev/schemas/tombstone-request.json",
  type: "object",
  additionalProperties: false,
  required: ["scope", "refs", "reason", "cascadePolicy"],
  properties: {
    scope: scopeSchema,
    refs: {
      type: "array",
      minItems: 1,
      items: memoryRefSchema,
    },
    reason: { type: "string", minLength: 1 },
    cascadePolicy: {
      type: "string",
      enum: ["none", "mark_derived_stale", "tombstone_derived"],
    },
  },
} as const
