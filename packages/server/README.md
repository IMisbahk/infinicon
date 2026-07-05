# @infinicon/server

[![npm version](https://img.shields.io/npm/v/@infinicon/server)](https://www.npmjs.com/package/@infinicon/server)

Reference memory server for the [Infinicon](https://github.com/IMisbahk/infinicon) v0 API.

Requires **Bun** (uses `Bun.serve` and optional `Bun.sql` for Postgres).

## Quick start

```bash
# install Bun first: https://bun.sh
npx @infinicon/server
# or
bunx @infinicon/server
```

Server listens on `http://0.0.0.0:8787` by default.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | — | Postgres connection string; omit for in-memory dev storage |
| `INFINICON_API_KEY` | — | When set, `/v0/*` routes require `Authorization: Bearer <key>` |
| `JOB_POLL_MS` | `2000` | Background job runner interval |

## Wire your agent

```bash
npm install @infinicon/sdk
```

```typescript
import { openMemory } from "@infinicon/sdk"

const memory = openMemory({
  tenantId: "demo",
  namespaceId: "my-app",
})
```

Set `INFINICON_BASE_URL=http://localhost:8787` (or your deployed URL).

## Docker

From the repo root (or use a published image after release):

```bash
docker build -t infinicon-server .
docker run -p 8787:8787 infinicon-server
```

With Postgres:

```bash
docker run -p 8787:8787 -e DATABASE_URL="postgres://..." infinicon-server
```

## Deploy to Render

Use the [Deploy to Render](https://render.com/deploy?repo=https://github.com/IMisbahk/infinicon) button in the main README, or point Render at `render.yaml` in this repo.

## API

- `GET /health`
- `POST /v0/ingest`, `/v0/query`, `/v0/hydrate`, `/v0/assemble-context`, and other v0 routes

See [contracts/openapi/memory-api.v0.json](../../contracts/openapi/memory-api.v0.json).
