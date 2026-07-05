import { describe, expect, test } from "bun:test"
import { InfiniconClient, InfiniconSdkError, type Scope } from "../src"

type MockCall = {
  input: URL | RequestInfo
  init: RequestInit | undefined
}

const createMockFetch = (resolver: (call: MockCall) => Response | Promise<Response>) => {
  const calls: MockCall[] = []

  const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
    const call = { input, init }
    calls.push(call)
    return resolver(call)
  }

  return { fetchImpl, calls }
}

const scope: Scope = {
  tenantId: "tenant-1",
  namespaceId: "ns-1",
}

type ClientMethod =
  | "query"
  | "hydrate"
  | "assembleContext"
  | "consolidate"
  | "tombstone"
  | "subscribe"
  | "getJob"

const callMethodWithScope = async (
  method: ClientMethod,
  client: InfiniconClient,
  methodScope: Scope,
): Promise<unknown> => {
  switch (method) {
    case "query":
      return client.query({ scope: methodScope, query: "q" })
    case "hydrate":
      return client.hydrate({ scope: methodScope, refs: [] })
    case "assembleContext":
      return client.assembleContext({
        scope: methodScope,
        task: "task",
        budget: { maxTokens: 128 },
      })
    case "consolidate":
      return client.consolidate({ scope: methodScope, trigger: "manual" })
    case "tombstone":
      return client.tombstone({
        scope: methodScope,
        refs: [],
        reason: "cleanup",
        cascadePolicy: "none",
      })
    case "subscribe":
      return client.subscribe({ scope: methodScope, eventTypes: ["memory.indexed"] })
    case "getJob":
      return client.getJob({ scope: methodScope, jobId: "job-1" })
  }
}

describe("InfiniconClient", () => {
  test("posts ingest requests to the v0 ingest path", async () => {
    const mock = createMockFetch(() =>
      Response.json({
        results: [
          {
            ref: { id: "ep-1", type: "episode", scope },
            status: "created",
          },
        ],
      }),
    )

    const client = new InfiniconClient({
      baseUrl: "https://memory.example.com",
      fetchImpl: mock.fetchImpl,
      apiKey: "secret-token",
    })

    const response = await client.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "hello",
          createdBy: "agent:test",
          dedupeKey: "ingest-1",
        },
      ],
      consistency: "indexed",
    })

    expect(response.results[0]?.status).toBe("created")
    expect(mock.calls).toHaveLength(1)

    const firstCall = mock.calls[0]
    expect(firstCall?.input).toBe("https://memory.example.com/v0/memory/ingest")
    expect(firstCall?.init?.method).toBe("POST")

    const headers = new Headers(firstCall?.init?.headers)
    expect(headers.get("authorization")).toBe("Bearer secret-token")
    expect(headers.get("content-type")).toBe("application/json")

    const body = JSON.parse(String(firstCall?.init?.body)) as {
      scope: Scope
      consistency: string
    }

    expect(body.scope.tenantId).toBe("tenant-1")
    expect(body.consistency).toBe("indexed")
  })

  test("throws sdk error when scope is missing mandatory fields", async () => {
    const mock = createMockFetch(() => Response.json({ ok: true }))
    const client = new InfiniconClient({
      baseUrl: "https://memory.example.com",
      fetchImpl: mock.fetchImpl,
    })

    const methods: ClientMethod[] = [
      "query",
      "hydrate",
      "assembleContext",
      "consolidate",
      "tombstone",
      "subscribe",
      "getJob",
    ]

    for (const method of methods) {
      expect(() =>
        callMethodWithScope(method, client, {
          tenantId: "",
          namespaceId: "",
        }),
      ).toThrow(InfiniconSdkError)
    }

    expect(mock.calls).toHaveLength(0)
  })

  test("maps api errors into InfiniconSdkError", async () => {
    const mock = createMockFetch(() =>
      Response.json(
        {
          error: {
            code: "consistency_not_supported",
            message: "strong consistency is unavailable",
            retryable: false,
          },
        },
        { status: 409 },
      ),
    )

    const client = new InfiniconClient({
      baseUrl: "https://memory.example.com",
      fetchImpl: mock.fetchImpl,
    })

    try {
      await client.query({ scope, query: "build status", consistency: "strong" })
      throw new Error("expected query to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(InfiniconSdkError)
      const sdkError = error as InfiniconSdkError
      expect(sdkError.code).toBe("consistency_not_supported")
      expect(sdkError.status).toBe(409)
      expect(sdkError.retryable).toBe(false)
    }
  })

  test("routes all v0 operations to expected endpoint paths", async () => {
    const mock = createMockFetch(() => Response.json({ ok: true }))
    const client = new InfiniconClient({
      baseUrl: "https://memory.example.com",
      fetchImpl: mock.fetchImpl,
    })

    await client.query({ scope, query: "q" })
    await client.hydrate({ scope, refs: [] })
    await client.assembleContext({
      scope,
      task: "task",
      budget: { maxTokens: 128 },
    })
    await client.consolidate({ scope, trigger: "manual" })
    await client.tombstone({ scope, refs: [], reason: "r", cascadePolicy: "none" })
    await client.subscribe({ scope, eventTypes: ["memory.indexed"] })
    await client.getJob({ scope, jobId: "job-1" })

    expect(mock.calls.map((call) => call.input)).toEqual([
      "https://memory.example.com/v0/memory/query",
      "https://memory.example.com/v0/memory/hydrate",
      "https://memory.example.com/v0/memory/assemble-context",
      "https://memory.example.com/v0/memory/consolidate",
      "https://memory.example.com/v0/memory/tombstone",
      "https://memory.example.com/v0/memory/subscribe",
      "https://memory.example.com/v0/memory/get-job",
    ])
  })
})
