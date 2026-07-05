import { InMemoryRuntime } from "../runtime"

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })

export type RuntimeServer = {
  fetch(request: Request): Promise<Response>
  runtime: InMemoryRuntime
}

export const createRuntimeServer = (): RuntimeServer => {
  const runtime = new InMemoryRuntime()

  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", runtime: "in-memory" })
    }

    if (request.method !== "POST") {
      return json({ code: "method_not_allowed", message: "only POST is supported" }, 405)
    }

    const payload = await request.json()

    if (url.pathname === "/v0/ingest") {
      return json(runtime.ingest(payload))
    }

    if (url.pathname === "/v0/query") {
      return json(runtime.query(payload))
    }

    if (url.pathname === "/v0/hydrate") {
      return json(runtime.hydrate(payload))
    }

    if (url.pathname === "/v0/assemble-context") {
      return json(runtime.assembleContext(payload))
    }

    if (url.pathname === "/v0/consolidate") {
      return json(runtime.consolidate(payload))
    }

    if (url.pathname === "/v0/tombstone") {
      return json(runtime.tombstone(payload))
    }

    if (url.pathname === "/v0/subscribe") {
      return json(runtime.subscribe(payload))
    }

    if (url.pathname === "/v0/get-job") {
      try {
        return json(runtime.getJob(payload))
      } catch {
        return json({ code: "not_found", message: "job not found" }, 404)
      }
    }

    return json({ code: "not_found", message: "endpoint not found" }, 404)
  }

  return { fetch, runtime }
}

export const startRuntimeServer = (port: number): Bun.Server => {
  const server = createRuntimeServer()
  return Bun.serve({
    port,
    fetch: server.fetch,
  })
}
