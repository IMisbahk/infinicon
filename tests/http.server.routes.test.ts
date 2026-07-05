import { describe, expect, test } from "bun:test"
import { createServer } from "../src/transport/httpServer"

describe("http routes", () => {
  test("supports ingest and query routes", async () => {
    const server = await createServer()

    const ingestResponse = await server.fetch(
      new Request("http://local/v0/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { tenantId: "tenant-1", namespaceId: "ns-1" },
          episodes: [
            {
              contentType: "application/json",
              content: { text: "bun runtime" },
              dedupeKey: "r1",
              createdBy: { id: "agent-1", kind: "agent" },
              metadata: {},
            },
          ],
        }),
      }),
    )

    expect(ingestResponse.status).toBe(200)

    const queryResponse = await server.fetch(
      new Request("http://local/v0/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { tenantId: "tenant-1", namespaceId: "ns-1" },
          query: "bun",
          limit: 5,
        }),
      }),
    )

    expect(queryResponse.status).toBe(200)
    const queryBody = await queryResponse.json()
    expect(queryBody.refs.length).toBeGreaterThanOrEqual(1)
  })

  test("returns 400 for invalid ingest request", async () => {
    const server = await createServer()

    const response = await server.fetch(
      new Request("http://local/v0/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: { tenantId: "tenant-1" } }),
      }),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.code).toBe("invalid_scope")
  })
})
