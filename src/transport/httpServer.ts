import { MemoryService, toHttpError } from "../services/memoryService"
import { createInMemoryStoragePorts } from "../storage/inMemory"

export type HttpHandler = {
  fetch: (request: Request) => Promise<Response>
}

const json = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export const createServer = (): HttpHandler => {
  const storage = createInMemoryStoragePorts()
  const service = new MemoryService(storage)

  return {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url)

      if (pathname === "/health" && request.method === "GET") {
        return json({ status: "ok" })
      }

      if (pathname === "/v0/ingest" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.ingest(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      if (pathname === "/v0/query" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.query(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      if (pathname === "/v0/hydrate" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.hydrate(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      if (pathname === "/v0/assemble-context" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.assembleContext(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      if (pathname === "/v0/consolidate" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.consolidate(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      if (pathname === "/v0/tombstone" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.tombstone(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      if (pathname === "/v0/subscribe" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.subscribe(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      if (pathname.startsWith("/v0/jobs/") && request.method === "GET") {
        try {
          const jobId = pathname.slice("/v0/jobs/".length)
          const payload = {
            scope: {
              tenantId: request.headers.get("x-tenant-id") ?? "default-tenant",
              namespaceId: request.headers.get("x-namespace-id") ?? "default-namespace",
            },
            jobId,
          }
          return json(await service.getJob(payload))
        } catch (error) {
          const mapped = toHttpError(error)
          return json(mapped.body, mapped.status)
        }
      }

      return json({ code: "not_found", message: "route not found" }, 404)
    },
  }
}
