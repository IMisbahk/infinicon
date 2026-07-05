# Reference Runtime Skeleton

This document describes the initial reference runtime skeleton implemented in this repository.

It follows the architecture and v0 specs without expanding beyond current ownership boundaries.

## Module layout

- `src/runtime/types.ts`
  - Core data model and API request/response types mapped from v0 specs
- `src/runtime/ports.ts`
  - Storage port contracts (`EpisodeStore`, `GraphStore`, `IndexStore`, `MetadataStore`) and shared runtime contracts
- `src/runtime/plugins.ts`
  - Plugin contracts (`Extractor`, `Embedder`, `Ranker`, `Consolidator`, `Formatter`) plus no-op/default embedder implementations
- `src/runtime/adapters/inMemoryStores.ts`
  - In-memory adapter implementations for all storage ports
- `src/runtime/service.ts`
  - Runtime service implementing ingest/query/hydrate/assembleContext/consolidate/tombstone/subscribe/getJob
- `src/runtime/errors.ts`, `src/runtime/validation.ts`, `src/runtime/utils.ts`
  - Shared validation, errors, ids, scope matching, and token estimation helpers

## Implemented semantics

- Scoped operations enforced via `assertScope`
- Ingest idempotency via dedupe key resolution in `EpisodeStore`
- Query returning refs before hydration semantics
- Hydrate returning `objects` and `missing` refs
- Context assembly producing structured `WorkingContext` with warnings:
  - `empty_context`
  - `truncated`
  - `eventual_consistency`
  - `disputed_memory_included`
  - `superseded_memory_included`
  - `required_ref_omitted`
- Tombstone behavior hiding removed content from query/context and removing index entries
- Job state handling for consolidation lifecycle in `MetadataStore`

## Explicit limitations in this skeleton

- In-memory adapters are for development and tests only
- No authz/authn transport layer yet (deferred by project roadmap)
- Consolidator behavior is plugin-owned and optional in runtime config
- Index retrieval is lexical/deterministic only in this skeleton

## Verification

Run from repo root:

```bash
bun test
python3 scripts/spec_integrity_check.py
python3 -m unittest discover -s tests -v
```
