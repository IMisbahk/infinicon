import { describe, expect, test } from "bun:test"
import {
  InMemoryEpisodeStore,
  InMemoryGraphStore,
  InMemoryIndexStore,
  InMemoryMetadataStore,
  InMemoryObjectStore,
  JobRunner,
  MemoryRuntimeService,
  createDefaultPluginHost,
  createRuntimeDeps,
} from "../src/runtime"

const scope = { tenantId: "t1", namespaceId: "n1" }

describe("jobRunner", () => {
  test("processes enqueued consolidate jobs", async () => {
    const metadataStore = new InMemoryMetadataStore()
    const bootstrap = createDefaultPluginHost()
    const service = new MemoryRuntimeService(
      createRuntimeDeps(
        {
          episodeStore: new InMemoryEpisodeStore(),
          graphStore: new InMemoryGraphStore(),
          indexStore: new InMemoryIndexStore(),
          metadataStore,
          objectStore: new InMemoryObjectStore(),
        },
        bootstrap,
      ),
    )

    await service.ingest({
      scope,
      episodes: [
        {
          contentType: "text/plain",
          content: "queued consolidation source",
          createdBy: { id: "agent", kind: "agent" },
        },
      ],
    })

    const queued = await service.consolidate({ scope, trigger: "manual", mode: "enqueue" })
    expect(queued.status).toBe("queued")

    const runner = new JobRunner(service, metadataStore)
    await runner.processBatch()

    const job = await service.getJob({ scope, jobId: queued.jobId })
    expect(job.status).toBe("completed")
  })
})
