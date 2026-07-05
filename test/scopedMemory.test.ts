import { afterEach, describe, expect, test } from "bun:test"
import {
  createClient,
  openMemory,
  scopeFromEnv,
  withScope,
  type Scope,
} from "../src"

const scope: Scope = {
  tenantId: "tenant-1",
  namespaceId: "ns-1",
}

const createMockFetch = () => {
  const calls: Array<{ path: string; body: unknown }> = []
  const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
    const path = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ path, body })

    if (path.endsWith("/v0/query")) {
      return Response.json({
        refs: [{ ref: { id: "ep-1", type: "episode", scope }, score: 1 }],
      })
    }
    if (path.endsWith("/v0/hydrate")) {
      return Response.json({
        objects: [{ contentType: "text/plain", content: "user prefers rust" }],
      })
    }
    if (path.endsWith("/v0/ingest")) {
      return Response.json({ results: [{ status: "created" }] })
    }
    if (path.endsWith("/v0/assemble-context")) {
      return Response.json({ context: "assembled", refs: [] })
    }

    return Response.json({ ok: true })
  }

  return { fetchImpl, calls }
}

describe("scoped memory helpers", () => {
  const envSnapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...envSnapshot }
  })

  test("scopeFromEnv reads tenant and namespace from env", () => {
    process.env.INFINICON_TENANT_ID = " acme "
    process.env.INFINICON_NAMESPACE_ID = "chat"
    process.env.INFINICON_AGENT_ID = "agent-1"

    expect(scopeFromEnv()).toEqual({
      tenantId: "acme",
      namespaceId: "chat",
      agentId: "agent-1",
    })
  })

  test("createClient reads base url and api key from env", () => {
    process.env.INFINICON_BASE_URL = "http://memory.local"
    process.env.INFINICON_API_KEY = "tok"

    const mock = createMockFetch()
    const client = createClient({ fetchImpl: mock.fetchImpl })
    const memory = withScope(client, scope)

    return memory.remember("hello").then(() => {
      expect(mock.calls[0]?.path).toBe("http://memory.local/v0/ingest")
      expect(mock.calls[0]?.body).toMatchObject({
        scope: { tenantId: "tenant-1", namespaceId: "ns-1" },
        episodes: [{ content: "hello" }],
      })
    })
  })

  test("remember and recall bind scope automatically", async () => {
    const mock = createMockFetch()
    const memory = withScope(createClient({ fetchImpl: mock.fetchImpl }), scope)

    await memory.remember("user prefers rust")
    const text = await memory.recall("favorite language")

    expect(text).toBe("user prefers rust")
    expect(mock.calls[0]?.body).toMatchObject({ scope })
    expect(mock.calls[1]?.body).toMatchObject({ scope, query: "favorite language" })
    expect(mock.calls[2]?.body).toMatchObject({ scope })
  })

  test("openMemory is a one-liner over env defaults", async () => {
    process.env.INFINICON_BASE_URL = "http://memory.local"
    process.env.INFINICON_TENANT_ID = "demo"
    process.env.INFINICON_NAMESPACE_ID = "app"

    const mock = createMockFetch()
    const memory = openMemory(undefined, createClient({ fetchImpl: mock.fetchImpl }))

    await memory.context("what does the user prefer?")

    expect(mock.calls[0]?.body).toMatchObject({
      scope: { tenantId: "demo", namespaceId: "app" },
      task: "what does the user prefer?",
    })
  })
})
