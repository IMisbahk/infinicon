import { describe, expect, test } from "bun:test"
import { createServer } from "../src/transport/httpServer"

describe("http server", () => {
  test("returns health status", async () => {
    const server = await createServer()
    const response = await server.fetch(new Request("http://local/health"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe("infinicon-runtime")
    expect(body.storage).toBe("in-memory")
    expect(body.plugins).toEqual({
      totalRegisteredPlugins: 4,
      registeredByKind: {
        extractor: 1,
        embedder: 1,
        ranker: 1,
        consolidator: 1,
        formatter: 0,
        storage_adapter: 0,
      },
    })
    expect(body.metrics).toBeDefined()
  })
})
