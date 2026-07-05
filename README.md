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

## Runtime Bootstrap

The repository now includes a conservative reference runtime bootstrap aligned with the v0 specifications:

- runtime contracts and port interfaces
- in-memory development adapter
- reference HTTP server (`/health` and `/v0/*` endpoints)
- thin TypeScript SDK client
- contract and server tests

See [Runtime Bootstrap](docs/runtime-bootstrap.md) for package details, verification, and current limits.

Quick verify:

```bash
npm test
```

Run server:

```bash
npm run start:server
```

This implementation remains intentionally spec-first and does not redefine architecture or non-goals.

- no agent orchestration logic
- no model-provider coupling
- no production storage backend assumptions

