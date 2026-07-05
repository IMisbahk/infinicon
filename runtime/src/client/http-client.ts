import type {
  AssembleContextRequest,
  AssembleContextResponse,
  ConsolidateRequest,
  ConsolidateResponse,
  GetJobRequest,
  GetJobResponse,
  HydrateRequest,
  HydrateResponse,
  IngestRequest,
  IngestResponse,
  QueryRequest,
  QueryResponse,
  SubscribeRequest,
  TombstoneRequest,
  TombstoneResponse,
} from "../types"

const postJson = async <T>(baseUrl: string, path: string, payload: unknown): Promise<T> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(`request failed ${response.status}: ${JSON.stringify(body)}`)
  }

  return response.json() as Promise<T>
}

export class InfiniconClient {
  constructor(private readonly baseUrl: string) {}

  health(): Promise<{ status: string; runtime: string }> {
    return fetch(`${this.baseUrl}/health`).then((res) => res.json())
  }

  ingest(request: IngestRequest): Promise<IngestResponse> {
    return postJson(this.baseUrl, "/v0/ingest", request)
  }

  query(request: QueryRequest): Promise<QueryResponse> {
    return postJson(this.baseUrl, "/v0/query", request)
  }

  hydrate(request: HydrateRequest): Promise<HydrateResponse> {
    return postJson(this.baseUrl, "/v0/hydrate", request)
  }

  assembleContext(request: AssembleContextRequest): Promise<AssembleContextResponse> {
    return postJson(this.baseUrl, "/v0/assemble-context", request)
  }

  consolidate(request: ConsolidateRequest): Promise<ConsolidateResponse> {
    return postJson(this.baseUrl, "/v0/consolidate", request)
  }

  tombstone(request: TombstoneRequest): Promise<TombstoneResponse> {
    return postJson(this.baseUrl, "/v0/tombstone", request)
  }

  subscribe(request: SubscribeRequest): Promise<{ events: unknown[]; cursor?: string }> {
    return postJson(this.baseUrl, "/v0/subscribe", request)
  }

  getJob(request: GetJobRequest): Promise<GetJobResponse> {
    return postJson(this.baseUrl, "/v0/get-job", request)
  }
}
