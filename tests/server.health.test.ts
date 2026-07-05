import { describe, expect, test } from "bun:test"
import { createServer } from "../src/transport/httpServer"

describe("http server", () => {
  test("returns health status", async () => {
    const server = createServer()
    const response = await server.fetch(new Request("http://local/health"))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ status: "ok" })
  })
})
