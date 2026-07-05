# Contracts

Machine-readable contracts derived from v0 prose specs.

These files are draft artifacts intended to reduce drift between prose specs and implementation work.
They do **not** supersede `docs/specs/*`; they encode those specs in consumable formats.

## Layout

- `openapi/memory-api.v0.json` — OpenAPI 3.1 draft for Memory API v0 operations
- `schemas/data-model.v0.schema.json` — JSON Schema for core durable memory primitives
- `schemas/context-assembly.v0.schema.json` — JSON Schema for context assembly request/response envelope
- `schemas/plugin-interface.v0.schema.json` — JSON Schema for plugin descriptor contract
- `schemas/storage-ports.v0.schema.json` — JSON Schema for storage adapter capability descriptor
- `fixtures/*.json` — representative valid examples used by validation
- `scripts/validate_contracts.py` — minimal contract validation runner

## Validate

```bash
python3 contracts/scripts/validate_contracts.py
```

The script checks:

1. JSON Schema validation for selected fixture payloads
2. Required OpenAPI path/schema presence for core v0 operations

## Notes

- Keep changes conservative and spec-aligned
- If behavior changes, update `docs/specs/*` first, then update contracts
- Add fixtures for new normative behavior before changing implementations
