import { describe, expect, test } from "bun:test"
import { InfiniconClient } from "@infinicon/sdk"
import { MemorySession } from "../src/memorySession"

const scope = { tenantId: "demo", namespaceId: "test", agentId: "bot-1" }

describe("MemorySession", () => {
  test("ingests turns and assembles context via sdk client", async () => {
    const calls: string[] = []

    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })

    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input)
      const path = new URL(url).pathname
      calls.push(path)

      if (path === "/v0/ingest") {
        return jsonResponse({ results: [{ status: "created" }] })
      }

      if (path === "/v0/assemble-context") {
        return jsonResponse({
          context: {
            scope,
            task: "hello",
            budget: { maxTokens: 512 },
            segments: [{ ref: { id: "ep_1", type: "episode", scope }, content: "user: hello", score: 1 }],
            tokenEstimate: 4,
            truncated: false,
            warnings: [],
            generatedAt: new Date().toISOString(),
          },
        })
      }

      if (path === "/v0/consolidate") {
        return jsonResponse({ jobId: "job_1", status: "queued" })
      }

      return jsonResponse({ code: "not_found" }, 404)
    }

    const client = new InfiniconClient({ baseUrl: "http://memory.local", fetchImpl })
    const session = new MemorySession({
      client,
      scope,
      agentId: "bot-1",
      contextMaxTokens: 512,
      consolidateEveryTurns: 1,
    })

    const assembled = await session.assembleForTask("hello")
    expect(assembled.context.segments.length).toBe(1)

    await session.rememberUserMessage("hello")
    await session.rememberAssistantMessage("hi there")
    await session.completeTurn()

    expect(calls).toContain("/v0/assemble-context")
    expect(calls).toContain("/v0/ingest")
    expect(calls).toContain("/v0/consolidate")
  })

  test("recallForTask fans out lexical queries", async () => {
    const fetchImpl = async (input: URL | RequestInfo) => {
      const path = new URL(String(input)).pathname

      if (path === "/v0/query") {
        return new Response(
          JSON.stringify({
            refs: [
              {
                ref: { id: "ep_1", type: "episode", scope },
                score: 1,
                reason: "lexical match",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }

      if (path === "/v0/hydrate") {
        return new Response(
          JSON.stringify({
            objects: [
              {
                id: "ep_1",
                type: "episode",
                scope,
                createdAt: new Date().toISOString(),
                createdBy: { id: "user", kind: "user" },
                status: "active",
                contentType: "text/plain",
                content: "user: my favorite language is rust",
                metadata: {},
              },
            ],
            missing: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ code: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }

    const client = new InfiniconClient({ baseUrl: "http://memory.local", fetchImpl })
    const session = new MemorySession({
      client,
      scope,
      agentId: "bot-1",
      contextMaxTokens: 512,
      consolidateEveryTurns: 8,
    })

    const recalled = await session.recallForTask("whats my fav prog lang?")
    expect(recalled.segments.length).toBe(1)
    expect(recalled.segments[0]?.content).toContain("rust")
  })
})
