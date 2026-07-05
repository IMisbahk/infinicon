# Runtime Bootstrap (consolidated)

The reference runtime lives in the repository root under `src/`, not in separate bootstrap packages.

## Layout

- `src/runtime/` — `MemoryRuntimeService`, storage ports, in-memory adapters, plugin contracts
- `src/transport/httpServer.ts` — HTTP routing for v0 memory API
- `src/server.ts` — Bun server entrypoint
- `src/client.ts` — typed SDK client

## Packages

- `packages/core-types/` — spec-aligned contracts and validators
- `packages/plugin-host/` — plugin registration host

## Verification

```bash
bun test
bun run dev
bun run verify
```

## Removed (post-consolidation)

The following parallel implementations were removed:

- `runtime/` standalone package
- `packages/runtime-core`, `runtime-adapters-memory`, `runtime-types`
- `packages/reference-server`, `packages/sdk-ts`
- `src/core/`, `src/services/`, `src/domain/`, legacy CJS under `src/api/` and `src/storage/*.js`

See [Reference runtime architecture](../architecture/reference-runtime.md) for module details.
