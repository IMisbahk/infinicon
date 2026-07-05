# Reference Runtime Skeleton

This document describes the consolidated reference runtime in this repository.

## Module layout

- `src/runtime/types.ts` — core data model and API request/response types
- `src/runtime/ports.ts` — storage port contracts
- `src/runtime/plugins.ts` — plugin contracts and default implementations
- `src/runtime/adapters/inMemoryStores.ts` — in-memory adapter implementations
- `src/runtime/service.ts` — `MemoryRuntimeService` (all v0 operations)
- `src/transport/httpServer.ts` — HTTP routing layer
- `src/server.ts` — Bun server entrypoint
- `src/client.ts` — typed SDK client

## Verification

```bash
bun test
bun run dev
```

See [Reference runtime architecture](reference-runtime.md) for semantics and limitations.
