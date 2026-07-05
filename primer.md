# Primer — Infinicon
Last updated: 2026-07-05

## Status
Active implementation in progress on `claude` branch. Reference server skeleton is now live with typed domain contracts, in-memory storage ports, API service, route wiring, and passing tests.

## What I know so far
Infinicon remains spec-first, and specs/ADRs are still the source of truth. This branch now contains machine-readable contracts under `contracts/` and executable Bun runtime code under `src/`, with tests in `tests/`. Implemented API operations include ingest/query/hydrate/assembleContext/consolidate/tombstone/subscribe/getJob with conservative semantics and scoped behavior.

## Next session
Read CLAUDE.md, run `bun run verify`, inspect open tasks, then continue hardening server behavior and expanding tests for edge/failure semantics.
