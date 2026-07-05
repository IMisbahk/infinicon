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

## Reference Skeleton (Phase 2)

This branch includes a conservative reference skeleton aligned to roadmap Phase 2:

- TypeScript runtime contracts in `src/core/types.ts`
- In-memory storage port adapters:
  - `EpisodeStore`: `src/adapters/inMemoryEpisodeStore.ts`
  - `GraphStore`: `src/adapters/inMemoryGraphStore.ts`
  - `IndexStore`: `src/adapters/inMemoryIndexStore.ts`
  - `MetadataStore`: `src/adapters/inMemoryMetadataStore.ts`
- Core service operations in `src/core/runtimeService.ts`:
  - `ingest`
  - `query`
  - `hydrate`
  - `assembleContext`
  - `tombstone`
  - `consolidate`
  - `getJob`
  - `subscribe`
- Minimal Bun HTTP server with `GET /health` and v0 endpoints in `src/server/index.ts`
- Thin client SDK in `src/sdk/client.ts`
- Contract tests in `tests/runtime.test.ts`

### Run locally

```bash
bun test
bun run src/server/index.ts
```

Server default: `http://localhost:3100`

### Implemented API endpoints

- `POST /v0/ingest`
- `POST /v0/query`
- `POST /v0/hydrate`
- `POST /v0/assemble-context`
- `POST /v0/tombstone`
- `POST /v0/consolidate`
- `POST /v0/get-job`
- `POST /v0/subscribe`

### Current limits and integration points

The reference implementation is intentionally conservative and keeps clean extension seams for other subsystems:

- Lifecycle persistence is in-memory only and process-local
- Consolidation jobs are metadata-driven stubs for plugin-owned synthesis
- Query ranking is simple lexical overlap in the in-memory index adapter
- Tombstone cascade currently surfaces affected refs from graph provenance chain and reserves deeper cascade behavior for evolution pipeline phases
- Plugin host and conformance harness are not implemented yet

These boundaries are intentional to preserve spec-first modularity and avoid leaking storage or model vendor assumptions into the core runtime API.

