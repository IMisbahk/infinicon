import { describe, expect, test } from "bun:test"
import { createServer } from "../src/transport/httpServer"

describe("http auth", () => {
  test("rejects protected routes when api key is configured", async () => {
    const previous = process.env.INFINICON_API_KEY
    process.env.INFINICON_API_KEY = "test-secret"

    try {
      const server = await createServer()
      const response = await server.fetch(
        new Request("http://local/v0/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope: { tenantId: "t", namespaceId: "n" }, query: "x" }),
        }),
      )

      expect(response.status).toBe(401)
    } finally {
      if (previous === undefined) delete process.env.INFINICON_API_KEY
      else process.env.INFINICON_API_KEY = previous
    }
  })

  test("allows protected routes with valid bearer token", async () => {
    const previous = process.env.INFINICON_API_KEY
    process.env.INFINICON_API_KEY = "test-secret"

    try {
      const server = await createServer()
      const response = await server.fetch(
        new Request("http://local/v0/query", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer test-secret",
          },
          body: JSON.stringify({ scope: { tenantId: "t", namespaceId: "n" }, query: "missing" }),
        }),
      )

      expect(response.status).toBe(200)
    } finally {
      if (previous === undefined) delete process.env.INFINICON_API_KEY
      else process.env.INFINICON_API_KEY = previous
    }
  })
})
