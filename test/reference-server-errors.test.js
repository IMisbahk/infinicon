import test from "node:test"
import assert from "node:assert/strict"
import { createReferenceServer } from "../packages/reference-server/src/server.js"

test("server returns structured invalid_json error", async () => {
  const { server } = createReferenceServer()
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port

  const response = await fetch(`http://127.0.0.1:${port}/v0/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad json",
  })

  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.equal(payload.error.code, "invalid_json")
  assert.equal(typeof payload.error.message, "string")
  assert.equal(typeof payload.error.retryable, "boolean")

  server.close()
})

test("server returns structured invalid_request error", async () => {
  const { server } = createReferenceServer()
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port

  const response = await fetch(`http://127.0.0.1:${port}/v0/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope: { tenantId: "tenant-a" },
      episodes: [],
    }),
  })

  assert.equal(response.status, 400)
  const payload = await response.json()
  assert.equal(payload.error.code, "invalid_request")
  assert.equal(typeof payload.error.details, "object")

  server.close()
})
