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
  SubscribeResponse,
  TombstoneRequest,
  TombstoneResponse,
} from "../core/types"

export class InfiniconClient {
  constructor(private readonly baseUrl: string) {}

  private async post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`request failed ${response.status}: ${text}`)
    }

    return (await response.json()) as TRes
  }

  ingest(req: IngestRequest): Promise<IngestResponse> {
    return this.post("/v0/ingest", req)
  }

  query(req: QueryRequest): Promise<QueryResponse> {
    return this.post("/v0/query", req)
  }

  hydrate(req: HydrateRequest): Promise<HydrateResponse> {
    return this.post("/v0/hydrate", req)
  }

  assembleContext(req: AssembleContextRequest): Promise<AssembleContextResponse> {
    return this.post("/v0/assemble-context", req)
  }

  consolidate(req: ConsolidateRequest): Promise<ConsolidateResponse> {
    return this.post("/v0/consolidate", req)
  }

  getJob(req: GetJobRequest): Promise<GetJobResponse> {
    return this.post("/v0/get-job", req)
  }

  subscribe(req: SubscribeRequest): Promise<SubscribeResponse> {
    return this.post("/v0/subscribe", req)
  }

  tombstone(req: TombstoneRequest): Promise<TombstoneResponse> {
    return this.post("/v0/tombstone", req)
  }
}
