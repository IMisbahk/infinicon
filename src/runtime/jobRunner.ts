import type { MetadataStore } from "./ports"
import type { MemoryRuntimeService } from "./service"

export type JobRunnerOptions = {
  pollIntervalMs?: number
  batchSize?: number
}

export class JobRunner {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly service: MemoryRuntimeService,
    private readonly metadataStore: MetadataStore,
    private readonly options: JobRunnerOptions = {},
  ) {}

  async processBatch(limit = this.options.batchSize ?? 8): Promise<number> {
    const jobs = await this.metadataStore.listQueuedJobs(limit)
    for (const job of jobs) {
      await this.service.processJob(job)
    }
    return jobs.length
  }

  start(pollIntervalMs = this.options.pollIntervalMs ?? 2000): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.processBatch()
    }, pollIntervalMs)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }
}
