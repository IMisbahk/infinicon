# Machine-Readable Contract Notes v0

This document explains how prose v0 specs map to machine-readable draft contracts in `docs/specs/*.json`.

## Why this exists

The repository is currently spec-first and architecture-first. We need a contract artifact that is usable by tooling without inventing behavior not yet accepted in prose specs.

## Mapping principles

- Use exact operation names from `docs/specs/memory-api.v0.md` (`ingest`, `query`, `hydrate`, `assembleContext`, `consolidate`, `tombstone`, `subscribe`, `getJob`)
- Keep required fields only where prose says must
- Keep open/undecided areas typed but permissive
- Reuse data-model semantics from `docs/specs/data-model.v0.md`
- Keep context assembly warning semantics aligned with `docs/specs/context-assembly.v0.md`

## Conservative choices made

- `MemoryFilters` is intentionally open (`additionalProperties: true`) because filter vocabulary is not fully fixed in prose
- `ContextConstraints` includes named constraints from `context-assembly.v0.md` and remains open for additional draft constraints
- `DurableMemoryObject` is an envelope shape, not an exhaustive union, because object-level fields still evolve in v0 prose
- `servers` uses placeholder URL only
- Paths use `/v0/memory/*` naming as a neutral transport layout for draft tooling

## Explicitly not locked yet

- Transport decision (REST vs gRPC vs both)
- Streaming semantics for query/assembleContext
- Pagination semantics across adapters
- Full strict schema for profile-specific metadata and content payloads
- Final error code taxonomy

These remain governed by roadmap/spec open questions and should not be treated as settled just because a draft OpenAPI file exists.

## Validation

- Run `python3 docs/specs/validate-machine-readable.py` to validate JSON parse and core structural invariants
- The validator intentionally avoids strict semantic inference where prose specs are still open

## Source references

- `docs/specs/memory-api.v0.md`
- `docs/specs/data-model.v0.md`
- `docs/specs/context-assembly.v0.md`
- `docs/specs/plugin-interface.v0.md`
- `docs/specs/storage-ports.v0.md`
- `docs/architecture/consistency.md`
- `docs/architecture/security.md`
- `docs/adr/0001-spec-first-development.md`
- `docs/adr/0004-storage-port-separation.md`
- `docs/adr/0005-consolidation-ownership.md`
