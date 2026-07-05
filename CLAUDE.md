# Project CLAUDE.md

## Session updates

### What improved
- Bootstrapped an initial runtime workspace under `packages/` with clear module boundaries
- Added core runtime contracts and storage port interfaces aligned with v0 specs
- Implemented a conservative in-memory adapter for development/testing
- Implemented reference server endpoints for health + core memory API flows
- Added a thin SDK client wrapper around server endpoints
- Added automated tests for runtime semantics, edge-case validation, and server error behavior
- Added runtime bootstrap docs at `docs/runtime-bootstrap.md`
- Hardened request validation across all current runtime operations
- Added baseline lifecycle event capture and subscription replay semantics

### What did not work
- No remote is configured in this repository, so push/PR-related commands are unavailable in current environment
- External explore agents could not be used in one planning step due to model credit limitations, so plan synthesis used local direct doc reads

### Permissions and constraints encountered
- Repository currently has no project CLAUDE before this file
- `.gitignore` includes `CLAUDE.md`; if this file should be tracked, use `git add -f CLAUDE.md`
- Global instruction constraints still apply:
  - no file deletion without explicit user approval
  - no dependency additions without explicit user approval
  - surgical edits over broad rewrites

## Current implementation map
- `packages/runtime-types` — contract helpers and validation
- `packages/runtime-core` — ports, runtime services, error model
- `packages/runtime-adapters-memory` — in-memory adapter for all storage ports
- `packages/reference-server` — HTTP transport for v0 routes
- `packages/sdk-ts` — thin client wrapper
- `test/` — runtime semantics and server integration tests

## Verification
- Run all tests: `npm test`
- Start reference server: `npm run start:server`

## Notes for next session
- Keep implementation changes mapped to spec docs first, then code
- Next high-value work is machine-readable API schema generation and conformance fixtures from current runtime behavior
- Replace in-memory event/job handling with durable adapter-backed implementations without changing public runtime semantics
