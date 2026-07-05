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

## Machine-Readable Draft Artifacts

These artifacts are draft contracts generated from the prose v0 specs. They are tooling aids, not a replacement for normative prose specs.

- [Memory API OpenAPI draft](docs/specs/memory-api.v0.openapi.json)
- [Data model schema draft](docs/specs/data-model.v0.schema.json)
- [Context assembly schema draft](docs/specs/context-assembly.v0.schema.json)
- [Plugin interface schema draft](docs/specs/plugin-interface.v0.schema.json)
- [Storage ports schema draft](docs/specs/storage-ports.v0.schema.json)
- [Contract mapping notes](docs/specs/machine-readable-contract-notes.v0.md)
- [Validation script](docs/specs/validate-machine-readable.py)

Run validation locally:

```bash
python3 docs/specs/validate-machine-readable.py
```

If a prose spec changes, update machine-readable artifacts in the same change.

