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
  Scope,
  SubscribeRequest,
  SubscribeResponse,
  TombstoneRequest,
  TombstoneResponse,
} from "./types"
import { InfiniconSdkError } from "./errors"
import { HttpClient, type HttpClientConfig } from "./http"

export type InfiniconClientConfig = HttpClientConfig

const withScope = <TRequest extends { scope: Scope }>(request: TRequest): TRequest => {
  if (!request.scope?.tenantId || !request.scope?.namespaceId) {
    throw new InfiniconSdkError({
      code: "invalid_scope",
      message: "scope.tenantId and scope.namespaceId are required",
    })
  }

  return request
}

export class InfiniconClient {
  private readonly http: HttpClient

  public constructor(config: InfiniconClientConfig) {
    this.http = new HttpClient(config)
  }

  public ingest(request: IngestRequest): Promise<IngestResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/ingest",
      body: withScope(request),
    })
  }

  public query(request: QueryRequest): Promise<QueryResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/query",
      body: withScope(request),
    })
  }

  public hydrate(request: HydrateRequest): Promise<HydrateResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/hydrate",
      body: withScope(request),
    })
  }

  public assembleContext(
    request: AssembleContextRequest,
  ): Promise<AssembleContextResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/assemble-context",
      body: withScope(request),
    })
  }

  public consolidate(request: ConsolidateRequest): Promise<ConsolidateResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/consolidate",
      body: withScope(request),
    })
  }

  public tombstone(request: TombstoneRequest): Promise<TombstoneResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/tombstone",
      body: withScope(request),
    })
  }

  public subscribe(request: SubscribeRequest): Promise<SubscribeResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/subscribe",
      body: withScope(request),
    })
  }

  public getJob(request: GetJobRequest): Promise<GetJobResponse> {
    return this.http.request({
      method: "POST",
      path: "/v0/memory/get-job",
      body: withScope(request),
    })
  }
}
