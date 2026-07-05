# Specifications

This directory contains Infinicon v0 specifications.

Human-readable specs are the normative source of truth.

## Core v0 Specs

- [Data model v0](data-model.v0.md)
- [Memory API v0](memory-api.v0.md)
- [Plugin interface v0](plugin-interface.v0.md)
- [Storage ports v0](storage-ports.v0.md)
- [Context assembly v0](context-assembly.v0.md)

## Phase 1 Contract Specs

- [Machine-readable contract v0](machine-readable-contract.v0.md)
- [API compatibility policy v0](api-compatibility-policy.v0.md)
- [Conformance test plan v0](conformance-test-plan.v0.md)

## Machine-readable artifacts

CI-validated machine-readable contracts live under [`../../contracts/`](../contracts/README.md).

Storage manifest contracts live under [`../contracts/`](../contracts/README.md).

Mapping notes: [machine-readable-contract-notes.v0.md](machine-readable-contract-notes.v0.md)

## Update policy

When a normative prose spec changes:

1. Update corresponding machine-readable artifact under `contracts/` in the same change
2. Update mapping notes if assumptions changed
3. Run:

```bash
python3 contracts/scripts/validate_contracts.py
bun test packages/core-types/test
```

4. Update or add fixtures under `contracts/fixtures/` when request or response shape changes

## Notes

- Breaking public contract changes require a new major spec version.
- Keep prose specs and machine-readable contracts aligned.
- Do not let implementation drift define behavior ahead of specs.
