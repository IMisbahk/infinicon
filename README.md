# infinicon

> give your ai agents unbounded context.

Infinicon is a production-grade memory runtime for AI agents.

It is currently in a spec-first architecture phase. Implementation follows accepted specifications and ADRs.

## Start Here

- [Vision](docs/vision.md)
- [Glossary](docs/glossary.md)
- [Architecture overview](docs/architecture/overview.md)
- [Reference runtime](docs/architecture/reference-runtime.md)
- [Plugin host architecture](docs/architecture/plugin-host.md)
- [Roadmap](docs/roadmap.md)
- [Specifications index](docs/specs/README.md)
- [Architecture decision records](docs/adr/README.md)

## Repository Layout

```
src/
  runtime/          # canonical memory runtime (MemoryRuntimeService + adapters)
  transport/        # HTTP routing layer
  server.ts         # Bun server entrypoint
  client.ts         # typed SDK client
  types.ts          # SDK-facing type exports
packages/
  core-types/       # spec-aligned contracts, validators, schemas
  plugin-host/      # plugin registration and lifecycle host
contracts/          # machine-readable OpenAPI + JSON schemas (CI canonical)
docs/
  specs/            # normative prose specifications
  contracts/        # storage manifest contracts
examples/           # documentation examples
tests/              # runtime, server, and devops tests
```

## Canonical Subsystems

| Subsystem | Location |
|-----------|----------|
| Runtime | `src/runtime/service.ts` |
| Server | `src/server.ts` + `src/transport/httpServer.ts` |
| SDK | `src/client.ts` |
| Core types | `packages/core-types/` |
| Plugin host | `packages/plugin-host/` |
| Storage adapters | `src/runtime/adapters/inMemoryStores.ts` |
| API contracts | `contracts/` |
| Storage contracts | `docs/contracts/` |

## Run Locally

```bash
bun test
bun run dev          # memory server (separate terminal)
bun run example:simple  # minimal one-file agent (recommended to start)
bun run example:agent   # full agent-chat example
```

Copy env for the agent example:

```bash
cp examples/agent-chat/.env.example examples/agent-chat/.env
```

Server default: `http://localhost:8787`

### API Endpoints

- `GET /health`
- `POST /v0/ingest`
- `POST /v0/query`
- `POST /v0/hydrate`
- `POST /v0/assemble-context`
- `POST /v0/tombstone`
- `POST /v0/consolidate`
- `POST /v0/subscribe`
- `POST /v0/get-job`
- `GET /v0/jobs/{jobId}`

## Verification

```bash
bun run verify
python3 scripts/spec_integrity_check.py
python3 contracts/scripts/validate_contracts.py
node tests/validate-examples.js
```

## Machine-Readable Contracts

Draft machine-readable artifacts derived from v0 prose specs live under [`contracts/`](contracts/README.md).

- OpenAPI: `contracts/openapi/memory-api.v0.json`
- JSON Schemas: `contracts/schemas/*`
- Fixtures: `contracts/fixtures/*`

Storage manifests and adapter capability descriptors live under [`docs/contracts/`](docs/contracts/README.md).

Prose specs in `docs/specs/*.md` remain normative. Update prose first, then contracts.

## Packages

- [`@infinicon/sdk`](packages/sdk/package.json): TypeScript client for the memory API
- [`@infinicon/core-types`](packages/core-types/README.md): spec-aligned TypeScript contracts, validators, and JSON schemas
- [`@infinicon/plugin-host`](packages/plugin-host/src/index.ts): plugin registration host

## Examples

- [Examples overview](examples/README.md)

## Current Limits

- In-memory storage only (process-local)
- Consolidation jobs are metadata-driven stubs with optional plugin-owned synthesis
- Lexical index ranking in the reference adapter
- No authn/authz transport layer yet

These boundaries are intentional to preserve spec-first modularity.
