# Memory API Specification v0

Status: Draft

This document defines the human-readable v0 API contract for Infinicon. Machine-readable schemas should be generated after this draft is reviewed and accepted.

## API Principles

- Every operation must be scoped.
- Writes must be idempotent where retry is expected.
- Queries should return memory references before hydrated content.
- Context assembly is first-class.
- Derived memory must preserve provenance.
- Deletion must be explicit and observable.
- Async operations must expose job state.

## Common Concepts

### Scope

All requests must include a scope.

At minimum:

- `tenantId`
- `namespaceId`

Optional:

- `agentId`
- `sessionId`
- domain-specific filters

### MemoryRef

A memory ref identifies memory without requiring full content hydration.

Illustrative shape:

```typescript
type MemoryRef = {
  id: string
  type: "episode" | "atom" | "consolidation" | "link"
  scope: Scope
}
```

### Error Shape

Errors should be structured:

```typescript
type MemoryApiError = {
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}
```

## Operation: ingest

Writes one or more episodes into memory.

### Request

```typescript
type IngestRequest = {
  scope: Scope
  episodes: IngestEpisode[]
  consistency?: "accepted" | "indexed"
}
```

Each episode should include:

- `contentType`
- `content`
- `dedupeKey`
- `createdBy`
- `metadata`

### Response

```typescript
type IngestResponse = {
  results: {
    ref: MemoryRef
    status: "created" | "deduplicated" | "rejected"
    error?: MemoryApiError
  }[]
}
```

### Semantics

- If a dedupe key matches a previous ingest in the same scope, the runtime must return the original ref.
- `consistency: "accepted"` means the episode is durable but may not be indexed yet.
- `consistency: "indexed"` means the runtime should not return until the episode is visible to query, or until a timeout/error occurs.
- Extraction and consolidation may happen asynchronously.

## Operation: query

Returns ranked memory references matching a query.

### Request

```typescript
type QueryRequest = {
  scope: Scope
  query: string
  filters?: MemoryFilters
  limit?: number
  consistency?: "strong" | "eventual"
}
```

### Response

```typescript
type QueryResponse = {
  refs: {
    ref: MemoryRef
    score: number
    reason?: string
    warnings?: ContextWarning[]
  }[]
  cursor?: string
}
```

### Semantics

- Query returns refs, not full memory content.
- The score is comparable only within the same query response unless a ranker declares stronger semantics.
- Tombstoned memory must not be returned.
- Disputed and superseded memory may be included only when filters allow it.

## Operation: hydrate

Loads full memory objects for refs.

### Request

```typescript
type HydrateRequest = {
  scope: Scope
  refs: MemoryRef[]
  includeProvenance?: boolean
}
```

### Response

```typescript
type HydrateResponse = {
  objects: DurableMemoryObject[]
  missing: MemoryRef[]
}
```

### Semantics

- Hydrate must enforce scope and authorization.
- Missing refs must be reported rather than silently ignored.
- Tombstoned content must not be returned unless the caller has explicit audit permission.

## Operation: assembleContext

Assembles task-specific working context within a budget.

This is the primary agent-facing operation.

### Request

```typescript
type AssembleContextRequest = {
  scope: Scope
  task: string
  budget: ContextBudget
  filters?: MemoryFilters
  constraints?: ContextConstraints
  consistency?: "strong" | "eventual"
}
```

### Response

```typescript
type AssembleContextResponse = {
  context: WorkingContext
}
```

### Semantics

- The runtime selects, ranks, hydrates, truncates, and orders memory segments.
- The response must include `tokenEstimate`, `truncated`, and warnings.
- The response must preserve segment provenance.
- Empty memory must return an explicit empty working context, not synthesized filler.
- The runtime should prefer active, relevant, fresh memory unless constraints say otherwise.

### Budget

The context budget should support:

- Maximum token estimate.
- Optional maximum segment count.
- Optional reserved tokens for system or user prompt material.

Token estimates are estimates. The runtime should expose tokenizer assumptions when available.

## Operation: consolidate

Requests or schedules consolidation for a scope.

### Request

```typescript
type ConsolidateRequest = {
  scope: Scope
  trigger: "manual" | "scheduled" | "threshold" | "idle"
  filters?: MemoryFilters
  mode?: "enqueue" | "run_now"
}
```

### Response

```typescript
type ConsolidateResponse = {
  jobId: string
  status: "queued" | "running" | "completed" | "failed"
}
```

### Semantics

- Consolidation may be asynchronous.
- The runtime owns job state and provenance.
- Consolidator plugins own synthesis behavior.
- Failed consolidation must not corrupt existing active memory.

## Operation: tombstone

Deletes or invalidates memory by creating tombstones.

### Request

```typescript
type TombstoneRequest = {
  scope: Scope
  refs: MemoryRef[]
  reason: string
  cascadePolicy: "none" | "mark_derived_stale" | "tombstone_derived"
}
```

### Response

```typescript
type TombstoneResponse = {
  results: {
    ref: MemoryRef
    status: "tombstoned" | "already_tombstoned" | "not_found" | "rejected"
    affectedDerivedRefs?: MemoryRef[]
    error?: MemoryApiError
  }[]
}
```

### Semantics

- Tombstoned memory must be excluded from normal query and context assembly.
- Indexes must remove or hide tombstoned content.
- Derived memory handling depends on cascade policy.
- The runtime must prevent tombstoned content from reappearing through stale indexes.

## Operation: subscribe

Subscribes to memory lifecycle events.

### Request

```typescript
type SubscribeRequest = {
  scope: Scope
  eventTypes?: MemoryEventType[]
  cursor?: string
}
```

### Event Types

Initial event types:

- `episode.ingested`
- `atom.extracted`
- `memory.indexed`
- `consolidation.started`
- `consolidation.completed`
- `consolidation.failed`
- `memory.disputed`
- `memory.superseded`
- `memory.tombstoned`

### Semantics

- Subscriptions are for lifecycle awareness, not distributed consensus.
- Consumers must tolerate duplicate events.
- Events should include a cursor or offset when transport supports it.

## Operation: getJob

Fetches asynchronous job state.

### Request

```typescript
type GetJobRequest = {
  scope: Scope
  jobId: string
}
```

### Response

```typescript
type GetJobResponse = {
  jobId: string
  type: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: MemoryApiError
}
```

## Compatibility

Breaking changes to this API require a new major spec version.

Non-breaking changes may add optional fields, new event types, new warning codes, or new plugin-declared capabilities.

## Open Questions

- Should v0 expose REST, gRPC, or both?
- Should query and assemble support streaming partial results?
- Should tombstone be synchronous by default or always job-backed?
- How should pagination work across heterogeneous storage adapters?
