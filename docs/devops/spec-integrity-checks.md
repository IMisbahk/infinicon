# Spec Integrity Checks

This repository is spec-first and documentation-driven.

To keep docs and specs reliable under parallel development, the devops subsystem provides a deterministic repository integrity check.

## What is enforced

`python3 scripts/spec_integrity_check.py` validates:

- Required top-level docs exist.
- Required architecture docs exist.
- Required v0 spec files exist and declare `Status: Draft`.
- ADR index (`docs/adr/README.md`) matches ADR files and numbering is contiguous.
- README doc links resolve to existing markdown files.

The check is intentionally conservative and fast. It avoids framework/dependency lock-in and uses Python standard library only.

## Local usage

Run from repository root:

```bash
python3 scripts/spec_integrity_check.py
python3 -m unittest discover -s tests -v
```

## CI usage

GitHub Actions workflow `.github/workflows/spec-integrity.yml` runs:

1. Spec integrity check.
2. Unit tests for devops tooling.

## Extending checks

When adding new mandatory spec artifacts, update these lists in `scripts/spec_integrity_check.py`:

- `REPO_REQUIRED_FILES`
- `ARCH_REQUIRED_FILES`
- `SPEC_REQUIRED_FILES`

Keep checks tied to accepted ADR/spec guarantees. Do not encode product behavior that belongs to runtime implementation teams.
