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

## Draft machine-readable artifacts

- `memory-api.v0.openapi.json`
- `data-model.v0.schema.json`
- `context-assembly.v0.schema.json`
- `plugin-interface.v0.schema.json`
- `storage-ports.v0.schema.json`
- `machine-readable-contract-notes.v0.md`
- `validate-machine-readable.py`
- `run-conformance.py`
- `fixtures/*.json`

## Update policy

When a normative prose spec changes:

1. Update corresponding machine-readable artifact in the same change
2. Update `machine-readable-contract-notes.v0.md` if mapping assumptions changed
3. Run:

```bash
python3 docs/specs/validate-machine-readable.py
python3 docs/specs/run-conformance.py
```

4. Ensure JSON parse remains valid for all machine-readable files
5. Update or add fixtures when request or response shape changes

## Notes

- Breaking public contract changes require a new major spec version.
- Keep prose specs and machine-readable contracts aligned.
- Do not let implementation drift define behavior ahead of specs.
- Keep draft schemas conservative while open spec questions remain unresolved.
