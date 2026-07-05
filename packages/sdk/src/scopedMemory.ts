import type { InfiniconClient } from "./client"
import type {
  ActorRef,
  AssembleContextRequest,
  AssembleContextResponse,
  ConsolidateRequest,
  GetJobRequest,
  HydrateRequest,
  IngestRequest,
  QueryRequest,
  Scope,
  SubscribeRequest,
  TombstoneRequest,
} from "./types"

export class ScopedMemory {
  constructor(
    private readonly client: InfiniconClient,
    private readonly scope: Scope,
  ) {}

  get scopeRef(): Scope {
    return this.scope
  }

  ingest(request: Omit<IngestRequest, "scope">): ReturnType<InfiniconClient["ingest"]> {
    return this.client.ingest({ ...request, scope: this.scope })
  }

  query(request: Omit<QueryRequest, "scope">): ReturnType<InfiniconClient["query"]> {
    return this.client.query({ ...request, scope: this.scope })
  }

  hydrate(request: Omit<HydrateRequest, "scope">): ReturnType<InfiniconClient["hydrate"]> {
    return this.client.hydrate({ ...request, scope: this.scope })
  }

  assembleContext(
    request: Omit<AssembleContextRequest, "scope">,
  ): ReturnType<InfiniconClient["assembleContext"]> {
    return this.client.assembleContext({ ...request, scope: this.scope })
  }

  consolidate(request: Omit<ConsolidateRequest, "scope">): ReturnType<InfiniconClient["consolidate"]> {
    return this.client.consolidate({ ...request, scope: this.scope })
  }

  tombstone(request: Omit<TombstoneRequest, "scope">): ReturnType<InfiniconClient["tombstone"]> {
    return this.client.tombstone({ ...request, scope: this.scope })
  }

  subscribe(request: Omit<SubscribeRequest, "scope">): ReturnType<InfiniconClient["subscribe"]> {
    return this.client.subscribe({ ...request, scope: this.scope })
  }

  getJob(request: Omit<GetJobRequest, "scope">): ReturnType<InfiniconClient["getJob"]> {
    return this.client.getJob({ ...request, scope: this.scope })
  }

  remember(text: string, createdBy: ActorRef = { id: "user", kind: "user" }) {
    return this.ingest({
      episodes: [{ contentType: "text/plain", content: text, createdBy }],
    })
  }

  rememberTurn(user: string, assistant: string, agentId = this.scope.agentId ?? "agent") {
    return this.ingest({
      episodes: [
        { contentType: "text/plain", content: user, createdBy: { id: "user", kind: "user" } },
        { contentType: "text/plain", content: assistant, createdBy: { id: agentId, kind: "agent" } },
      ],
    })
  }

  async recall(query: string, limit = 8): Promise<string> {
    const hits = await this.query({ query, limit })
    if (hits.refs.length === 0) return ""

    const hydrated = await this.hydrate({ refs: hits.refs.map((row) => row.ref) })
    return hydrated.objects
      .map((object) => ("content" in object ? String(object.content) : JSON.stringify(object)))
      .join("\n")
  }

  context(task: string, maxTokens = 2048): Promise<AssembleContextResponse> {
    return this.assembleContext({
      task,
      budget: { maxTokens },
    })
  }
}
