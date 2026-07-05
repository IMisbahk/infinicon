import { sameScope } from "../core/scope"
import type { JobRecord, MemoryEvent, MetadataStore, Scope, SubscribeRequest } from "../core/types"

export class InMemoryMetadataStore implements MetadataStore {
  private readonly jobs = new Map<string, JobRecord>()
  private readonly events: MemoryEvent[] = []

  private jobKey(scope: Scope, jobId: string): string {
    return `${scope.tenantId}::${scope.namespaceId}::${scope.agentId ?? "_"}::${scope.sessionId ?? "_"}::${jobId}`
  }

  async createJob(job: JobRecord): Promise<void> {
    this.jobs.set(this.jobKey(job.scope, job.jobId), job)
  }

  async updateJob(job: JobRecord): Promise<void> {
    this.jobs.set(this.jobKey(job.scope, job.jobId), job)
  }

  async getJob(scope: Scope, jobId: string): Promise<JobRecord | null> {
    return this.jobs.get(this.jobKey(scope, jobId)) ?? null
  }

  async appendEvent(event: MemoryEvent): Promise<void> {
    this.events.push(event)
  }

  async listEvents(req: SubscribeRequest): Promise<MemoryEvent[]> {
    const requested = req.eventTypes
    const cursor = req.cursor

    return this.events.filter((event) => {
      if (!sameScope(event.scope, req.scope)) {
        return false
      }
      if (requested && requested.length > 0 && !requested.includes(event.type)) {
        return false
      }
      if (cursor && event.cursor <= cursor) {
        return false
      }
      return true
    })
  }
}
