import { describe, expect, test } from "bun:test"
import { createRuntimeServer } from "../src/server/http-server"
import { InfiniconClient } from "../src/client/http-client"

const scope = { tenantId: "tenant-a", namespaceId: "ns-a" }
const actor = { id: "agent-1", type: "agent" }

describe("runtime server and client", () => {
  test("health endpoint works", async () => {
    const server = createRuntimeServer()
    const response = await server.fetch(new Request("http://local/health", { method: "GET" }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe("ok")
  })

  test("http client can ingest query and assemble context", async () => {
    const app = createRuntimeServer()

    const fetchMock = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const request = new Request(typeof input === "string" ? input : input.toString(), init)
      return app.fetch(request)
    }

    // @ts-ignore monkeypatch for isolated test transport
    const previousFetch = globalThis.fetch
    // @ts-ignore test override
    globalThis.fetch = fetchMock

    try {
      const client = new InfiniconClient("http://local")

      const ingested = await client.ingest({
        scope,
        episodes: [{ contentType: "text/plain", content: "deployment checklist", createdBy: actor, dedupeKey: "a" }],
        consistency: "indexed",
      })

      expect(ingested.results[0]?.status).toBe("created")

      const query = await client.query({ scope, query: "deployment", consistency: "strong" })
      expect(query.refs.length).toBe(1)

      const context = await client.assembleContext({
        scope,
        task: "deployment",
        budget: { maxTokens: 128 },
        consistency: "strong",
      })

      expect(context.context.segments.length).toBe(1)
      expect(context.context.truncated).toBe(false)
    } finally {
      // @ts-ignore restore
      globalThis.fetch = previousFetch
    }
  })
})
