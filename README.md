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

## SDK Package (feat/sdk)

This branch includes an initial thin TypeScript SDK scaffold aligned with the Memory API v0 contract.

### Included

- Typed request and response models mirroring `docs/specs/memory-api.v0.md` and related v0 docs.
- `InfiniconClient` methods for v0 operations:
  - `ingest`
  - `query`
  - `hydrate`
  - `assembleContext`
  - `consolidate`
  - `tombstone`
  - `subscribe`
  - `getJob`
- Small HTTP layer with conservative error mapping to `InfiniconSdkError`.
- Unit tests for request shaping and error handling.

### Build and test

```bash
bun run build
bun test
bun run typecheck
```

### Notes

- Endpoints are intentionally thin integration points for the upcoming reference server implementation.
- The SDK does not implement server-side semantics and does not redesign API behavior outside the spec.

