# Deployment

## Reference server (Bun)

```bash
bun install
bun run dev
```

The server binds to `0.0.0.0:$PORT` (default `8787`).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | HTTP port (default `8787`) |
| `HOST` | no | Bind address (default `0.0.0.0`) |
| `DATABASE_URL` | no | Postgres connection string; omit for in-memory dev storage |
| `INFINICON_API_KEY` | no | When set, all `/v0/*` routes require `Authorization: Bearer <key>` |
| `JOB_POLL_MS` | no | Background job runner interval (default `2000`) |

## Storage modes

- **In-memory** (default): single-process, ephemeral — fine for local dev and CI.
- **Postgres** (`DATABASE_URL` set): durable JSONB-backed adapters with lexical index table. Render Postgres or any managed Postgres works.

Ephemeral filesystem on Render means local disk is not durable. Use Postgres for production persistence.

## Health and metrics

- `GET /health` — service status, plugin stats, storage mode, counters
- `GET /metrics` — JSON runtime counters (ingest/query/tombstone/jobs)

## Render

See [`render.yaml`](../../render.yaml) at repo root. Web service + optional managed Postgres.

Build: `bun install`  
Start: `bun run src/server.ts`

## Verification before deploy

```bash
bun run verify
```
