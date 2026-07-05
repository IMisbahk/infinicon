# infinicon

Persistent context for the coding assistant on this project.

## Session updates

### What improved
- Integrated parallel feature branches into `main` with dual-runtime preservation
- Machine-readable contracts live in both `docs/specs/` and `contracts/`
- Reference server skeleton at `src/server.ts` with domain, storage, and transport layers
- Runtime packages under `packages/` plus `src/runtime/` memory and reference stacks
- Plugin host, core-types validators, SDK clients, devops integrity checks, and examples

### What did not work
- `feat/events` skipped due to uncommitted doc edits in its worktree
- Dual runtime implementations required side-by-side type/port modules instead of a single merge

### Permissions and constraints encountered
- Never add yourself as a contributor or mention cursor in commits
- `.infinicon/` is local only and must not be committed
- No dependency additions without explicit approval

## Structure

- `docs/` — specs, ADRs, architecture, devops guardrails
- `contracts/` — OpenAPI + JSON schemas + fixtures + validation scripts
- `src/runtime/` — memory-runtime and reference service stacks
- `src/server.ts` — Bun reference server entrypoint
- `packages/` — core-types, plugin-host, runtime bootstrap modules
- `runtime/` — alternate reference skeleton package
- `examples/` — spec-aligned JSON examples
- `tests/` — runtime, server, contract, and devops tests

## Verification

```bash
bun test
python3 scripts/spec_integrity_check.py
python3 contracts/scripts/validate_contracts.py
python3 docs/specs/validate-machine-readable.py
bun run verify
```

## Bootstrap (every session)

1. Read `.infinicon/memory.md` first
2. Update `.infinicon/memory.md` when work completes
3. Keep README and docs aligned with repo changes
