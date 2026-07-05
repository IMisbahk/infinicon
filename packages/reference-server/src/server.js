import { createServer } from "node:http"
import { MemoryRuntime } from "../../runtime-core/src/runtime.js"
import { MemoryApiRuntimeError } from "../../runtime-core/src/errors.js"
import { createInMemoryAdapter } from "../../runtime-adapters-memory/src/memory-adapter.js"

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  }
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  if (chunks.length === 0) {
    return {}
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function toErrorResponse(error) {
  if (error instanceof MemoryApiRuntimeError) {
    return jsonResponse(400, { error: error.toResponseError() })
  }
  return jsonResponse(500, {
    error: {
      code: "internal_error",
      message: error?.message ?? "unexpected server error",
      retryable: false,
      details: {},
    },
  })
}

export function createReferenceServer({ runtime = null } = {}) {
  const adapter = createInMemoryAdapter()
  const liveRuntime = runtime ?? new MemoryRuntime(adapter)

  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        const res = jsonResponse(200, { ok: true, service: "infinicon-reference-server" })
        response.writeHead(res.statusCode, res.headers)
        response.end(res.body)
        return
      }

      if (request.method !== "POST") {
        const res = jsonResponse(404, { error: { code: "not_found", message: "route not found", retryable: false } })
        response.writeHead(res.statusCode, res.headers)
        response.end(res.body)
        return
      }

      const payload = await readJsonBody(request)
      let result

      if (request.url === "/v0/ingest") {
        result = await liveRuntime.ingest(payload)
      } else if (request.url === "/v0/query") {
        result = await liveRuntime.query(payload)
      } else if (request.url === "/v0/hydrate") {
        result = await liveRuntime.hydrate(payload)
      } else if (request.url === "/v0/assemble-context") {
        result = await liveRuntime.assembleContext(payload)
      } else if (request.url === "/v0/consolidate") {
        result = await liveRuntime.consolidate(payload)
      } else if (request.url === "/v0/tombstone") {
        result = await liveRuntime.tombstone(payload)
      } else if (request.url === "/v0/get-job") {
        result = await liveRuntime.getJob(payload)
      } else if (request.url === "/v0/subscribe") {
        result = await liveRuntime.subscribe(payload)
      } else {
        const res = jsonResponse(404, { error: { code: "not_found", message: "route not found", retryable: false } })
        response.writeHead(res.statusCode, res.headers)
        response.end(res.body)
        return
      }

      const res = jsonResponse(200, result)
      response.writeHead(res.statusCode, res.headers)
      response.end(res.body)
    } catch (error) {
      const res = toErrorResponse(error)
      response.writeHead(res.statusCode, res.headers)
      response.end(res.body)
    }
  })

  return {
    server,
    runtime: liveRuntime,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 4010)
  const { server } = createReferenceServer()
  server.listen(port, () => {
    process.stdout.write(`infinicon reference server listening on :${port}\n`)
  })
}
