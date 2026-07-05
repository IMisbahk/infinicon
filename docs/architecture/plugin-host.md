# Plugin Host Architecture

Status: Draft

This document describes the v0 plugin host implementation in this repository.

## Scope

The plugin host is responsible for:

- Registering trusted in-process plugins
- Validating plugin descriptors
- Validating plugin configuration at startup time
- Routing plugin execution by `(kind, name, version)`

The plugin host is intentionally not responsible for:

- Sandboxing (out of scope for v0)
- Dynamic plugin discovery or remote loading
- Model inference provider policy

## Alignment with specs

This implementation follows `docs/specs/plugin-interface.v0.md` by requiring descriptor fields:

- `name`
- `version`
- `kind`
- `supportedSpecVersion`
- `configSchema`
- `capabilities`
- `sideEffects`
- `idempotencyGuarantees`

It also enforces config validation during registration so invalid plugin config fails fast.

## Runtime model

The host keeps an in-memory registry:

- primary map by `(kind, name, version)`
- secondary index by `kind`

Registration fails for duplicate plugin keys, invalid descriptor fields, invalid config, or spec version mismatch.

Execution fails loudly when a plugin is missing.

The host returns defensive copies for `listByKind` so callers cannot mutate internal registry state accidentally.

## Integration points

The runtime can integrate this host into:

- write path plugin execution (extractor, embedder)
- read path plugin execution (ranker)
- async evolution pipeline (consolidator)
- formatter and storage adapter lifecycle

Those integrations belong to their owning subsystems and should call `PluginHost.run(...)` with typed inputs and outputs.
