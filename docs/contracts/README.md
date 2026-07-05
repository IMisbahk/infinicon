# Contracts

Machine-readable contract artifacts for accepted and draft specifications live here.

## Storage Contracts v0

- `storage-ports.v0.json` — canonical machine-readable manifest for storage port capabilities and guarantees from `docs/specs/storage-ports.v0.md`
- `storage-ports.v0.schema.json` — JSON Schema for the storage ports manifest
- `storage-adapter-capabilities.v0.schema.json` — JSON Schema for adapter capability descriptors required by the storage ports spec
- `examples/storage-adapter-capabilities.pgvector.example.v0.json` — example descriptor for a Postgres + pgvector style adapter
- `examples/storage-adapter-capabilities.local-dev.example.v0.json` — example descriptor for a local development adapter

## Contract Rules

- Prose specification remains source of truth when conflicts exist
- Contract files must be versioned (`*.v0.*`) and additive for non-breaking changes
- Breaking contract changes require a new major spec version and corresponding contract artifacts

## Validation

Run local validation:

```bash
python3 docs/contracts/validate_storage_contracts.py
```
