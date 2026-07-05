# @infinicon/sdk

TypeScript client for the Infinicon memory API v0.

```typescript
import { InfiniconClient } from "@infinicon/sdk"

const client = new InfiniconClient({
  baseUrl: "http://localhost:8787",
  apiKey: process.env.INFINICON_API_KEY,
})

await client.ingest({
  scope: { tenantId: "demo", namespaceId: "app" },
  episodes: [
    {
      contentType: "text/plain",
      content: "user prefers dark mode",
      createdBy: { id: "user-1", kind: "user" },
    },
  ],
})

const context = await client.assembleContext({
  scope: { tenantId: "demo", namespaceId: "app" },
  task: "what theme does the user prefer?",
  budget: { maxTokens: 1024 },
})
```

See [`examples/agent-chat`](../../examples/agent-chat/README.md) for a full agent loop.
