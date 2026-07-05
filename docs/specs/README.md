# Specs Workspace Guide

This directory contains normative prose specs and draft machine-readable contracts.

## Source of truth

Normative behavior is defined by prose specs and accepted ADRs.

Machine-readable artifacts are contract helpers for tooling and conformance work. They must stay conservative and must not silently define behavior that prose specs do not define.

## Artifacts

### Normative prose specs

- `data-model.v0.md`
- `memory-api.v0.md`
- `plugin-interface.v0.md`
- `storage-ports.v0.md`
- `context-assembly.v0.md`

### Draft machine-readable contracts

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

## Scope guard

Do not lock open questions into strict machine-readable constraints unless the prose spec has accepted that behavior.

If uncertain, keep schema permissive and document the rationale in `machine-readable-contract-notes.v0.md`.
