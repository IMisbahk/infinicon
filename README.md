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

