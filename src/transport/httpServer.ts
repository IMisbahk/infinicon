import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
  MemoryRuntimeService,
  toHttpError,
} from "../runtime"

export type HttpHandler = {
  fetch: (request: Request) => Promise<Response>
}

const json = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

export const createRuntime = (): MemoryRuntimeService => {
  return new MemoryRuntimeService({
    episodeStore: new InMemoryEpisodeStore(),
    graphStore: new InMemoryGraphStore(),
    indexStore: new InMemoryIndexStore(),
    metadataStore: new InMemoryMetadataStore(),
    objectStore: new InMemoryObjectStore(),
  })
}

export const createServer = (): HttpHandler => {
  const service = createRuntime()

  return {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url)

      if (pathname === "/health" && request.method === "GET") {
        return json({ ok: true, service: "infinicon-runtime" })
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

      if (pathname === "/v0/get-job" && request.method === "POST") {
        try {
          const payload = await request.json()
          return json(await service.getJob(payload))
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
