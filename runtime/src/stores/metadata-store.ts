import { createId } from "../id"
import type { JobRecord, JobStatus, MemoryEvent, Scope } from "../types"

const scopeMatch = (left: Scope, right: Scope): boolean =>
  left.tenantId === right.tenantId && left.namespaceId === right.namespaceId

export class InMemoryMetadataStore {
  private readonly jobs = new Map<string, JobRecord>()
  private readonly events: MemoryEvent[] = []

  createJob(input: { scope: Scope; type: string; status: JobStatus; result?: unknown }): JobRecord {
    const now = new Date().toISOString()
    const job: JobRecord = {
      jobId: createId("job"),
      type: input.type,
      scope: input.scope,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      result: input.result,
    }
    this.jobs.set(job.jobId, job)
    return job
  }

  updateJob(jobId: string, status: JobStatus, result?: unknown): JobRecord | undefined {
    const job = this.jobs.get(jobId)
    if (!job) return undefined
    job.status = status
    job.updatedAt = new Date().toISOString()
    if (result !== undefined) {
      job.result = result
    }
    return job
  }

  getJob(scope: Scope, jobId: string): JobRecord | undefined {
    const job = this.jobs.get(jobId)
    if (!job) return undefined
    if (!scopeMatch(job.scope, scope)) return undefined
    return job
  }

  appendEvent(event: Omit<MemoryEvent, "eventId" | "at">): MemoryEvent {
    const record: MemoryEvent = {
      eventId: createId("evt"),
      at: new Date().toISOString(),
      ...event,
    }
    this.events.push(record)
    return record
  }

  listEvents(input: {
    scope: Scope
    eventTypes?: string[]
    cursor?: string
  }): { events: MemoryEvent[]; cursor?: string } {
    const start = input.cursor ? Number.parseInt(input.cursor, 10) : 0
    const selected: MemoryEvent[] = []

    for (let i = Number.isFinite(start) ? start : 0; i < this.events.length; i += 1) {
      const event = this.events[i]
      if (!scopeMatch(event.scope, input.scope)) continue
      if (input.eventTypes && input.eventTypes.length > 0 && !input.eventTypes.includes(event.type)) continue
      selected.push(event)
    }

    return {
      events: selected,
      cursor: String(this.events.length),
    }
  }
}
