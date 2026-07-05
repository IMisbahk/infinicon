# Infinicon Runtime Skeleton (v0)

This package provides a spec-aligned in-memory runtime skeleton for Infinicon phase 2 bootstrap.

It is intentionally conservative and focuses on contract behavior:

- scoped ingest
- dedupe idempotency
- query returning refs
- hydrate missing reporting
- assembleContext warnings and budgeting
- tombstone exclusion semantics
- async-style job state for consolidate

## Status

Current implementation is an in-memory development adapter.

It is not a production storage adapter.

## Run tests

```bash
cd runtime
bun test
```

## Module layout

- `src/types.ts` - public contract types aligned to v0 specs
- `src/stores/` - in-memory storage port adapters
- `src/runtime.ts` - memory API operation implementation
- `src/server/http-server.ts` - reference HTTP server skeleton with health and v0 endpoints
- `src/client/http-client.ts` - thin client SDK for runtime endpoints
- `tests/runtime.test.ts` - contract behavior tests
- `tests/server-client.test.ts` - server and client integration tests

## Start server

```bash
cd runtime
bun run start
```

(or import `startRuntimeServer(port)` and launch from your app entrypoint)

Default port is `3000` and can be overridden with `PORT`.

```bash
PORT=4000 bun run start
```
 
## SDK usage

```ts
import { InfiniconClient } from "@infinicon/runtime"

const client = new InfiniconClient("http://localhost:3000")
const health = await client.health()
```

This SDK intentionally stays thin and does not own memory semantics.

Memory semantics stay in the runtime contract and server implementation.

## Notes

- `query` returns refs, not hydrated content.
- `hydrate` reports missing refs.
- tombstoned episodes are excluded from normal query and hydrate paths.
- consolidate supports `enqueue` and `run_now` job modes.
