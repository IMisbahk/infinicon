# Infinicon Runtime Skeleton (v0)

This package provides a spec-aligned in-memory runtime skeleton for Infinicon phase 2 bootstrap.

It is intentionally conservative and focuses on contract behavior:

- scoped ingest
- dedupe idempotency
- query returning refs
- hydrate missing reporting
- assembleContext warnings and budgeting
- tombstone exclusion semantics
- async-style job state for consolidate

## Status

Current implementation is an in-memory development adapter.

It is not a production storage adapter.

## Run tests

```bash
cd runtime
bun test
```

## Module layout

- `src/types.ts` - public contract types aligned to v0 specs
- `src/stores/` - in-memory storage port adapters
- `src/runtime.ts` - memory API operation implementation
- `tests/runtime.test.ts` - contract behavior tests

## Notes

- `query` returns refs, not hydrated content.
- `hydrate` reports missing refs.
- tombstoned episodes are excluded from normal query and hydrate paths.
- consolidate supports `enqueue` and `run_now` job modes.
