# Reference Runtime Skeleton

This document describes the initial in-memory reference runtime skeleton implemented for the v0 specification set.

## Scope

The skeleton is intentionally conservative and spec-aligned:

- Implements memory API service operations defined in `docs/specs/memory-api.v0.md`
- Uses separate in-memory storage ports aligned to `docs/specs/storage-ports.v0.md`
- Returns structured context outputs with warnings aligned to `docs/specs/context-assembly.v0.md`
- Preserves scope validation, dedupe conflict behavior, and tombstone handling semantics

It does **not** introduce framework coupling, transport assumptions, or production adapter behavior.

## Layout

- `src/core/`
  - shared assertions, ids, error conversion, event stream
- `src/storage/`
  - `episode-store.js`
  - `graph-store.js`
  - `index-store.js`
  - `metadata-store.js`
- `src/api/memory-service.js`
  - implementation of ingest/query/hydrate/assembleContext/consolidate/tombstone/subscribe/getJob
- `src/runtime/runtime.js`
  - runtime wiring for the in-memory skeleton
- `src/index.js`
  - runtime entrypoint export

## Running tests

```bash
node tests/run-tests.js
```

or directly:

```bash
node tests/validate-examples.js
node --test tests/runtime/memory-service.test.js
```

## Known limitations

- In-memory only, no persistence across process restarts
- Indexing mode is effectively synchronous in this adapter
- Consolidation logic is intentionally minimal and contract-focused
- No auth transport layer yet (consistent with spec-first repo phase)
