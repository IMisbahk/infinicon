import { InMemoryEpisodeStore, InMemoryGraphStore, InMemoryIndexStore, InMemoryMetadataStore } from "../runtime/in-memory-stores"
import { MemoryRuntimeService } from "../runtime/memory-runtime"

const runtime = new MemoryRuntimeService({
  episodeStore: new InMemoryEpisodeStore(),
  graphStore: new InMemoryGraphStore(),
  indexStore: new InMemoryIndexStore(),
  metadataStore: new InMemoryMetadataStore(),
})

const server = Bun.serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url)

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "infinicon-reference-skeleton" })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/ingest") {
      const body = await request.json()
      const result = await runtime.ingest(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 400 })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/query") {
      const body = await request.json()
      const result = await runtime.query(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 400 })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/hydrate") {
      const body = await request.json()
      const result = await runtime.hydrate(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 400 })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/assemble-context") {
      const body = await request.json()
      const result = await runtime.assembleContext(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 400 })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/consolidate") {
      const body = await request.json()
      const result = await runtime.consolidate(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 400 })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/tombstone") {
      const body = await request.json()
      const result = await runtime.tombstone(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 400 })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/subscribe") {
      const body = await request.json()
      const result = await runtime.subscribe(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 400 })
    }

    if (request.method === "POST" && url.pathname === "/v0/memory/get-job") {
      const body = await request.json()
      const result = await runtime.getJob(body)
      return Response.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 404 })
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log(`infinicon reference skeleton listening on http://localhost:${server.port}`)
