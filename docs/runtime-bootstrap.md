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
- Job handling is minimal and in-process

## Why this shape

The runtime follows the roadmap Phase 2 skeleton while preserving ADR constraints:

- spec-first contract implementation
- strict memory-runtime boundaries
- separate storage ports
- conservative lifecycle semantics over convenience
