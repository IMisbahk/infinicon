# Runtime Bootstrap (feat/bootstrap)

This branch introduces the first conservative reference-server bootstrap aligned with v0 specs.

## What exists now

- `packages/runtime-types`:
  - Core memory/API contract helpers and validation entry points
- `packages/runtime-core`:
  - Storage port interfaces (`EpisodeStore`, `GraphStore`, `IndexStore`, `MetadataStore`)
  - Runtime service orchestration for:
    - `ingest`
    - `query`
    - `hydrate`
    - `assembleContext`
    - `consolidate`
    - `tombstone`
    - `subscribe`
    - `getJob`
- `packages/runtime-adapters-memory`:
  - In-memory development adapter implementing all required ports
- `packages/reference-server`:
  - Minimal HTTP server exposing `/health` and `/v0/*` endpoints
- `packages/sdk-ts`:
  - Thin client wrappers around runtime endpoints

## Verification

Run tests:

```bash
npm test
```

Start reference server:

```bash
npm run start:server
```

## Current boundaries

This bootstrap intentionally does **not** include:

- model-provider-specific logic
- agent orchestration behavior
- production storage adapter semantics
- plugin sandboxing

## Known limitations

- Indexing/ranking is deterministic token-overlap baseline for bootstrap validation
- In-memory adapter is for development and conformance checks only
- Job handling is still in-process (not distributed), but now persists basic lifecycle state and supports retrieval through `getJob`
- Event stream is baseline in-memory lifecycle tracking and should be replaced by durable event infrastructure for production

## Validation and error baseline

Implemented conservative validation guards for:
- `ingest`
- `query`
- `hydrate`
- `assembleContext`
- `consolidate`
- `tombstone`
- `subscribe`
- `getJob`

Server-level error behavior now guarantees structured JSON for invalid request bodies (`invalid_json`) and runtime request validation failures (`invalid_request`).

## Event semantics baseline

Runtime now emits minimal lifecycle events into metadata store:
- `episode.ingested`
- `consolidation.started`
- `consolidation.completed` or `consolidation.queued`
- `memory.tombstoned`

`subscribe` returns scoped events since cursor with optional event-type filtering.

## Why this shape

The runtime follows the roadmap Phase 2 skeleton while preserving ADR constraints:

- spec-first contract implementation
- strict memory-runtime boundaries
- separate storage ports
- conservative lifecycle semantics over convenience
