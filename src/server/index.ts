import { InMemoryEpisodeStore } from "../adapters/inMemoryEpisodeStore"
import { InMemoryGraphStore } from "../adapters/inMemoryGraphStore"
import { InMemoryIndexStore } from "../adapters/inMemoryIndexStore"
import { InMemoryMetadataStore } from "../adapters/inMemoryMetadataStore"
import { IncrementingIdFactory } from "../core/id"
import { RuntimeService } from "../core/runtimeService"
import type {
  AssembleContextRequest,
  ConsolidateRequest,
  GetJobRequest,
  HydrateRequest,
  IngestRequest,
  QueryRequest,
  SubscribeRequest,
  TombstoneRequest,
} from "../core/types"

const runtime = new RuntimeService(
  new InMemoryEpisodeStore(),
  new InMemoryGraphStore(),
  new InMemoryIndexStore(),
  new InMemoryMetadataStore(),
  new IncrementingIdFactory("runtime"),
)

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

async function parseBody<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}

function handleError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "unknown error"
  const status = message.startsWith("job not found") ? 404 : 400
  return json(status, {
    error: {
      code: status === 404 ? "not_found" : "bad_request",
      message,
      retryable: false,
    },
  })
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3100),
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url)

    try {
      if (pathname === "/health") {
        return json(200, {
          ok: true,
          service: "infinicon-runtime",
        })
      }

      if (pathname === "/v0/ingest" && req.method === "POST") {
        const body = await parseBody<IngestRequest>(req)
        return json(200, await runtime.ingest(body))
      }

      if (pathname === "/v0/query" && req.method === "POST") {
        const body = await parseBody<QueryRequest>(req)
        return json(200, await runtime.query(body))
      }

      if (pathname === "/v0/hydrate" && req.method === "POST") {
        const body = await parseBody<HydrateRequest>(req)
        return json(200, await runtime.hydrate(body))
      }

      if (pathname === "/v0/assemble-context" && req.method === "POST") {
        const body = await parseBody<AssembleContextRequest>(req)
        return json(200, await runtime.assembleContext(body))
      }

      if (pathname === "/v0/consolidate" && req.method === "POST") {
        const body = await parseBody<ConsolidateRequest>(req)
        return json(200, await runtime.consolidate(body))
      }

      if (pathname === "/v0/get-job" && req.method === "POST") {
        const body = await parseBody<GetJobRequest>(req)
        return json(200, await runtime.getJob(body))
      }

      if (pathname === "/v0/subscribe" && req.method === "POST") {
        const body = await parseBody<SubscribeRequest>(req)
        return json(200, await runtime.subscribe(body))
      }

      if (pathname === "/v0/tombstone" && req.method === "POST") {
        const body = await parseBody<TombstoneRequest>(req)
        return json(200, await runtime.tombstone(body))
      }

      return json(404, {
        error: {
          code: "not_found",
          message: "route not found",
          retryable: false,
        },
      })
    } catch (error) {
      return handleError(error)
    }
  },
})

console.log(`infinicon runtime server listening on http://localhost:${server.port}`)
