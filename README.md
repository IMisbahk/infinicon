# infinicon

[![npm sdk](https://img.shields.io/npm/v/@infinicon/sdk?label=%40infinicon%2Fsdk)](https://www.npmjs.com/package/@infinicon/sdk)
[![npm core-types](https://img.shields.io/npm/v/@infinicon/core-types?label=%40infinicon%2Fcore-types)](https://www.npmjs.com/package/@infinicon/core-types)
[![CI](https://github.com/IMisbahk/infinicon/actions/workflows/ci.yml/badge.svg)](https://github.com/IMisbahk/infinicon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> give your ai agents unbounded context.

Infinicon is a **memory SDK + reference server** for AI agents. Use `@infinicon/sdk` from your app; run the reference server locally or on Render for storage and retrieval.

Specs and ADRs in `docs/` remain the source of truth for behavior.

## Install

```bash
npm install @infinicon/sdk
# or
bun add @infinicon/sdk
```

```typescript
import { openMemory } from "@infinicon/sdk"

const memory = openMemory()
await memory.remember("user prefers dark mode")
const prior = await memory.recall("theme preference")
```

## Support

If Infinicon helps your project, consider supporting development:

**[☕ Support via Razorpay](https://razorpay.me/@misbahkhursheed)**

(GitHub also shows a **Sponsor** heart on the repo via [`.github/FUNDING.yml`](.github/FUNDING.yml).)

## Start Here

**Building an agent?** → [`examples/simple-chat.ts`](examples/simple-chat.ts) + [`@infinicon/sdk`](packages/sdk/README.md)

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
packages/
  sdk/              # @infinicon/sdk — published npm client
  core-types/       # @infinicon/core-types — spec-aligned contracts
  plugin-host/      # plugin registration and lifecycle host
examples/
  simple-chat.ts    # one-file agent demo (start here)
  agent-chat/       # fuller SDK example with recall + consolidation
contracts/          # machine-readable OpenAPI + JSON schemas
docs/               # specs, ADRs, devops
tests/              # runtime, server, contract tests
```

## Canonical Subsystems

| Subsystem            | Location                                        |
| -------------------- | ----------------------------------------------- |
| **SDK (start here)** | `packages/sdk/` → `@infinicon/sdk`              |
| Runtime              | `src/runtime/service.ts`                        |
| Server               | `src/server.ts` + `src/transport/httpServer.ts` |
| Core types           | `packages/core-types/`                          |
| Plugin host          | `packages/plugin-host/`                         |
| Storage adapters     | `src/runtime/adapters/`                         |
| API contracts        | `contracts/`                                    |

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

| Command                  | What                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `bun run example:simple` | One-file chat agent ([`examples/simple-chat.ts`](examples/simple-chat.ts))                         |
| `bun run example:agent`  | Full example with recall + consolidation ([`examples/agent-chat/`](examples/agent-chat/README.md)) |
| JSON fixtures            | [`examples/memory-api/`](examples/memory-api/) etc. — spec samples, not runnable apps              |

See [examples/README.md](examples/README.md).

## Reference server notes

- Default storage is **in-memory** (lost on server restart). Set `DATABASE_URL` for Postgres.
- Retrieval in the reference stack is **lexical** unless you plug in embedder/ranker plugins.
- Optional Bearer auth via `INFINICON_API_KEY` on the server.
- [`docs/devops/deployment.md`](docs/devops/deployment.md) for Render/production.

## Publishing (maintainers)

Packages publish to npm on [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) or manual workflow dispatch.

1. Bump `version` in `packages/core-types/package.json` and `packages/sdk/package.json`
2. Add a GitHub repo secret `NPM_TOKEN` ([npm granular access token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with publish scope)
3. Create a release tag (e.g. `v0.1.1`) — triggers [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml)

```bash
bun run build:packages   # local dry run before release
```
