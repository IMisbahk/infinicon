# Primer — Infinicon
Last updated: 2026-07-05

## Status
SDK-first repo on `main`. Reference server + `@infinicon/sdk` are usable. Start with `bun run example:simple`.

## What works
- Memory API v0 over HTTP (`ingest`, `query`, `hydrate`, `assembleContext`, `consolidate`, `tombstone`, `subscribe`, `getJob`)
- Typed client: `packages/sdk` (`@infinicon/sdk`)
- Examples: `examples/simple-chat.ts`, `examples/agent-chat/`
- In-memory dev storage; Postgres when `DATABASE_URL` is set
- 96+ tests, `bun run verify`

## Next session
Run `bun run verify`, read [README.md](README.md), pick embedder/ranker quality or agent integration work.
