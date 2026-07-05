# infinicon

> give your ai agents unbounded context.

Infinicon is a production-grade memory runtime for AI agents.

It is currently in a spec-first architecture phase. The implementation should emerge from accepted specifications and ADRs, not from a rushed prototype.

## Start Here

- [Vision](docs/vision.md)
- [Glossary](docs/glossary.md)
- [Architecture overview](docs/architecture/overview.md)
- [System boundaries](docs/architecture/boundaries.md)
- [Consistency model](docs/architecture/consistency.md)
- [Security architecture](docs/architecture/security.md)
- [Roadmap](docs/roadmap.md)
- [Open decisions register](docs/open-decisions.md)
- [Spec review process](docs/spec-review-process.md)
- [Architecture decision records](docs/adr/README.md)
- [Reference runtime skeleton](docs/architecture/reference-runtime-skeleton.md)

## Reference Implementation (early)

- [Runtime skeleton](runtime/README.md)
- Includes in-memory runtime, Bun HTTP server skeleton, and thin typed client SDK

## Core Specs

- [Specifications index](docs/specs/README.md)
- [Data model v0](docs/specs/data-model.v0.md)
- [Memory API v0](docs/specs/memory-api.v0.md)
- [Plugin interface v0](docs/specs/plugin-interface.v0.md)
- [Storage ports v0](docs/specs/storage-ports.v0.md)
- [Context assembly v0](docs/specs/context-assembly.v0.md)
- [Machine-readable contract v0](docs/specs/machine-readable-contract.v0.md)
- [API compatibility policy v0](docs/specs/api-compatibility-policy.v0.md)
- [Conformance test plan v0](docs/specs/conformance-test-plan.v0.md)

## Examples

- [Examples overview](examples/README.md)
- [Data model examples](examples/data-model)
- [Memory API examples](examples/memory-api)
- [Context assembly examples](examples/context-assembly)
- [Plugin interface examples](examples/plugin-interface)

Validate examples locally:

```bash
node tests/validate-examples.js
```

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

### Runtime validation behavior

The reference server validates request shape and constraints before processing:

- Scope is required on every operation
- Unsupported consistency and mode values are rejected
- Empty ingest or tombstone batches are rejected
- Invalid budget fields are rejected

Validation errors return structured `bad_request` responses.

### Current limits and integration points

The reference implementation is intentionally conservative and keeps clean extension seams for other subsystems:

- Lifecycle persistence is in-memory only and process-local
- Consolidation jobs are metadata-driven stubs for plugin-owned synthesis
- Query ranking is simple lexical overlap in the in-memory index adapter
- Tombstone cascade currently surfaces affected refs from graph provenance chain and reserves deeper cascade behavior for evolution pipeline phases
- Plugin host and conformance harness are not implemented yet

These boundaries are intentional to preserve spec-first modularity and avoid leaking storage or model vendor assumptions into the core runtime API.

## Machine-Readable Draft Artifacts

These artifacts are draft contracts generated from the prose v0 specs. They are tooling aids, not a replacement for normative prose specs.

- [Memory API OpenAPI draft](docs/specs/memory-api.v0.openapi.json)
- [Data model schema draft](docs/specs/data-model.v0.schema.json)
- [Context assembly schema draft](docs/specs/context-assembly.v0.schema.json)
- [Plugin interface schema draft](docs/specs/plugin-interface.v0.schema.json)
- [Storage ports schema draft](docs/specs/storage-ports.v0.schema.json)
- [Contract mapping notes](docs/specs/machine-readable-contract-notes.v0.md)
- [Validation script](docs/specs/validate-machine-readable.py)
- [Conformance runner](docs/specs/run-conformance.py)
- [Conformance fixtures](docs/specs/fixtures)

Run validation locally:

```bash
python3 docs/specs/validate-machine-readable.py
python3 docs/specs/run-conformance.py
```

If a prose spec changes, update machine-readable artifacts in the same change.

