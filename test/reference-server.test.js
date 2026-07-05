import test from "node:test"
import assert from "node:assert/strict"
import { createReferenceServer } from "../packages/reference-server/src/server.js"

test("reference server exposes health and ingest/query flow", async () => {
  const { server } = createReferenceServer()

  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}`

  const health = await fetch(`${baseUrl}/health`)
  assert.equal(health.status, 200)
  const healthPayload = await health.json()
  assert.equal(healthPayload.ok, true)

  const scope = { tenantId: "tenant-srv", namespaceId: "namespace-srv" }

  const ingest = await fetch(`${baseUrl}/v0/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "server runtime memory",
          dedupeKey: "srv-1",
        },
      ],
      consistency: "accepted",
    }),
  })
  assert.equal(ingest.status, 200)

  const query = await fetch(`${baseUrl}/v0/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope,
      query: "runtime",
      consistency: "strong",
    }),
  })

  assert.equal(query.status, 200)
  const queryPayload = await query.json()
  assert.equal(queryPayload.refs.length, 1)

  server.close()
})
