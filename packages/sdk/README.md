# @infinicon/sdk

TypeScript client for the Infinicon memory API v0.

## Quick start

```typescript
import { openMemory } from "@infinicon/sdk"

const memory = openMemory()

await memory.remember("user prefers dark mode")
const prior = await memory.recall("theme preference")
const { context } = await memory.context("what theme does the user prefer?")
```

Set env vars (or pass config explicitly):

- `INFINICON_BASE_URL` — default `http://localhost:8787`
- `INFINICON_API_KEY` — optional Bearer token
- `INFINICON_TENANT_ID` / `INFINICON_NAMESPACE_ID` — scope defaults

## Explicit config

```typescript
import { createClient, scopeFromEnv, withScope } from "@infinicon/sdk"

const memory = withScope(
  createClient({ baseUrl: "http://localhost:8787", apiKey: process.env.INFINICON_API_KEY }),
  scopeFromEnv({ tenantId: "demo", namespaceId: "app" }),
)

await memory.rememberTurn("hi", "hello back")
```

## Low-level client

Every v0 route is still available on `InfiniconClient` when you need full control:

```typescript
import { createClient } from "@infinicon/sdk"

const client = createClient()
await client.ingest({ scope: { tenantId: "demo", namespaceId: "app" }, episodes: [...] })
```

See [`examples/agent-chat`](../../examples/agent-chat/README.md) for a full agent loop.
