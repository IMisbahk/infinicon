# infinicon

> give your ai agents unbounded context.

Infinicon is a production-grade memory runtime for AI agents.

It is currently in a spec-first architecture phase. The implementation should emerge from accepted specifications and ADRs, not from a rushed prototype.

## Start Here

- [Vision](docs/vision.md)
- [Glossary](docs/glossary.md)
- [Architecture overview](docs/architecture/overview.md)
- [System boundaries](docs/architecture/boundaries.md)
- [Roadmap](docs/roadmap.md)
- [Architecture decision records](docs/adr/README.md)

## Core Specs

- [Data model v0](docs/specs/data-model.v0.md)
- [Memory API v0](docs/specs/memory-api.v0.md)
- [Plugin interface v0](docs/specs/plugin-interface.v0.md)
- [Storage ports v0](docs/specs/storage-ports.v0.md)
- [Context assembly v0](docs/specs/context-assembly.v0.md)

## Reference Implementation Skeleton

This branch now includes a minimal TypeScript runtime skeleton aligned with the v0 specs.

Implemented paths:

- `ingest`
- `query`
- `hydrate`
- `assembleContext`
- `tombstone`
- `subscribe`
- `getJob`

Implementation location:

- `src/types.ts` typed API/domain shapes
- `src/ports.ts` storage port contracts
- `src/inmemory/stores.ts` in-memory port adapters
- `src/runtime.ts` runtime implementation
- `test/runtime.test.ts` behavior tests

### Run locally

```bash
bun run typecheck
bun test
```

Notes:

- The implementation is intentionally conservative and keeps to spec-level semantics.
- It uses in-memory adapters only (no production persistence).
- `subscribe` supports scoped cursor reads, at-least-once semantics, and loud failure on invalid cursor.
- Dedupe conflicts reject divergent content within the same scope.
- Tombstoned episode content is excluded from normal query/hydrate flows.
- Several operations remain skeleton-level (`consolidate`, `getJob`) pending broader subsystem ownership work.
- Events-first hardening was done without widening architecture boundaries.

## 
