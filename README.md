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

## Machine-readable Contracts (draft)

Draft machine-readable artifacts derived from v0 prose specs live under [`contracts/`](contracts/README.md).

- OpenAPI draft for Memory API v0: `contracts/openapi/memory-api.v0.json`
- JSON Schemas for data model, context assembly, plugin descriptors, and storage adapter capabilities: `contracts/schemas/*`
- Validation fixtures and checks: `contracts/fixtures/*`, `contracts/scripts/validate_contracts.py`

Validate contracts:

```bash
python3 contracts/scripts/validate_contracts.py
```

Spec-first rule still applies: update `docs/specs/*` first for behavior changes, then update contracts.

## Reference Server Skeleton (v0 draft)

This branch now includes a conservative Bun-based reference server skeleton aligned to current v0 specs.

Current runtime layout:

- `src/server.ts` — Bun entrypoint
- `src/transport/httpServer.ts` — HTTP routing layer
- `src/services/memoryService.ts` — Memory API service behavior
- `src/domain/types.ts` — typed request/response model
- `src/domain/validation.ts` — request validators
- `src/storage/ports.ts` — storage port interfaces
- `src/storage/inMemory.ts` — in-memory adapter implementations
- `tests/*.test.ts` — service/storage/route tests

Run the server:

```bash
bun run src/server.ts
```

Run tests:

```bash
bun test
```

Run full verification:

```bash
bun run verify
```

Notes:

- Scope enforcement and tombstone hiding are implemented for the in-memory adapter path
- Consolidation is job-backed and intentionally conservative in this skeleton
- This is a baseline implementation target, not the final production adapter set

