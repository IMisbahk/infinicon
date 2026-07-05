# infinicon

Persistent context for the coding assistant on this project.

## Session updates

### What improved
- Architecture consolidation sprint: one canonical stack per subsystem
- **Runtime**: `src/runtime/service.ts` (`MemoryRuntimeService`) with plugin support
- **Server**: `src/server.ts` + `src/transport/httpServer.ts`
- **SDK**: `src/client.ts` aligned to `/v0/*` contract routes
- **Core types**: `packages/core-types/` (spec-aligned contracts)
- **Plugin host**: `packages/plugin-host/`
- **Contracts**: `contracts/` for memory API; `docs/contracts/` for storage manifests
- Removed 7 parallel runtime stacks, 4 HTTP servers, 4 SDK clients, duplicate JSON in `docs/specs/`
- Tests: 81/81 pass; `bun run verify` passes

### What did not work
- Dual `-reference` / contract runtime stacks required careful test migration (adapter API differences)

### Permissions and constraints encountered
- Never add yourself as a contributor or mention cursor in commits
- `.infinicon/` is local only and must not be committed
- No dependency additions without explicit approval

## Structure

- `docs/` — specs, ADRs, architecture, devops guardrails
- `contracts/` — OpenAPI + JSON schemas + fixtures + validation scripts (CI canonical)
- `docs/contracts/` — storage manifest contracts
- `src/runtime/` — canonical memory runtime
- `src/server.ts` — Bun reference server entrypoint
- `packages/core-types/` — typed contract surface
- `packages/plugin-host/` — plugin registration host
- `examples/` — spec-aligned JSON examples
- `tests/` — runtime, server, contract, and devops tests

## Verification

```bash
bun test
python3 scripts/spec_integrity_check.py
python3 contracts/scripts/validate_contracts.py
bun run verify
```

## Bootstrap (every session)

1. Read `.infinicon/memory.md` first
2. Update `.infinicon/memory.md` when work completes
3. Keep README and docs aligned with repo changes
