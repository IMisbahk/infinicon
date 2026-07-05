import {
  InfiniconClient,
  type AssembleContextResponse,
  type ContextSegment,
  type ContextWarning,
  type Scope,
} from "@infinicon/sdk"

export type MemorySessionOptions = {
  client: InfiniconClient
  scope: Scope
  agentId: string
  contextMaxTokens: number
  consolidateEveryTurns: number
}

export type RecallResult = {
  segments: ContextSegment[]
  warnings: ContextWarning[]
  queriesTried: string[]
  refCount: number
}

const stopWords = new Set([
  "what",
  "whats",
  "what's",
  "is",
  "my",
  "the",
  "a",
  "an",
  "do",
  "you",
  "remember",
  "about",
  "that",
  "this",
  "how",
  "can",
  "please",
  "tell",
  "me",
  "fav",
  "favorite",
  "prog",
  "programming",
  "language",
])

const searchTermsFromTask = (task: string): string[] => {
  const normalized = task.toLowerCase().replace(/[^a-z0-9\s]/g, " ")
  const terms = normalized
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word))
  return [...new Set(terms)]
}

export class MemorySession {
  private readonly client: InfiniconClient
  private readonly scope: Scope
  private readonly agentId: string
  private readonly contextMaxTokens: number
  private readonly consolidateEveryTurns: number
  private turnCount = 0

  constructor(options: MemorySessionOptions) {
    this.client = options.client
    this.scope = options.scope
    this.agentId = options.agentId
    this.contextMaxTokens = options.contextMaxTokens
    this.consolidateEveryTurns = options.consolidateEveryTurns
  }

  async rememberUserMessage(text: string): Promise<void> {
    await this.client.ingest({
      scope: this.scope,
      episodes: [
        {
          contentType: "text/plain",
          content: `user: ${text}`,
          createdBy: { id: "user", kind: "user" },
          metadata: { role: "user", agentId: this.agentId },
        },
      ],
    })
  }

  async rememberAssistantMessage(text: string): Promise<void> {
    await this.client.ingest({
      scope: this.scope,
      episodes: [
        {
          contentType: "text/plain",
          content: `assistant: ${text}`,
          createdBy: { id: this.agentId, kind: "agent" },
          metadata: { role: "assistant", agentId: this.agentId },
        },
      ],
    })
  }

  async assembleForTask(task: string): Promise<AssembleContextResponse> {
    return this.client.assembleContext({
      scope: this.scope,
      task,
      budget: { maxTokens: this.contextMaxTokens, maxSegments: 16 },
      consistency: "eventual",
    })
  }

  // lexical search misses paraphrased questions — fan out queries and merge hits
  async recallForTask(task: string): Promise<RecallResult> {
    const queriesTried: string[] = []
    const queryPlan = [task, ...searchTermsFromTask(task), "user:", "assistant:"]
    const seenRefs = new Set<string>()
    const mergedRefs: Array<{ ref: ContextSegment["ref"]; score: number; reason?: string }> = []

    for (const queryText of queryPlan) {
      if (!queryText.trim()) continue
      queriesTried.push(queryText)

      const result = await this.client.query({
        scope: this.scope,
        query: queryText,
        limit: 8,
      })

      for (const row of result.refs) {
        const key = `${row.ref.type}:${row.ref.id}`
        if (seenRefs.has(key)) continue
        seenRefs.add(key)
        mergedRefs.push({ ref: row.ref, score: row.score, reason: row.reason })
      }

      if (mergedRefs.length >= 12) break
    }

    const warnings: ContextWarning[] = [
      {
        code: "eventual_consistency",
        message: "context assembled under eventual consistency",
      },
    ]

    if (mergedRefs.length === 0) {
      warnings.push({ code: "empty_context", message: "no memory matched the request" })
      return { segments: [], warnings, queriesTried, refCount: 0 }
    }

    mergedRefs.sort((a, b) => b.score - a.score)
    const hydrated = await this.client.hydrate({
      scope: this.scope,
      refs: mergedRefs.map((row) => row.ref),
    })

    const objectByRef = new Map(
      hydrated.objects.map((object) => [`${object.type}:${object.id}`, object]),
    )

    const segments: ContextSegment[] = []
    for (const row of mergedRefs) {
      const object = objectByRef.get(`${row.ref.type}:${row.ref.id}`)
      if (!object || object.type === "link") continue
      if (!("content" in object)) continue

      segments.push({
        ref: row.ref,
        content: object.content,
        score: row.score,
        reason: row.reason ?? "recall query hit",
        provenance: "provenance" in object ? object.provenance : undefined,
      })
      if (segments.length >= 16) break
    }

    if (segments.length === 0) {
      warnings.push({ code: "empty_context", message: "recall matched refs but nothing hydrated" })
    }

    return { segments, warnings, queriesTried, refCount: mergedRefs.length }
  }

  formatContextBlock(segments: ContextSegment[]): string {
    if (segments.length === 0) return "No prior memory matched this task."

    return segments
      .map((segment, index) => {
        const content =
          typeof segment.content === "string" ? segment.content : JSON.stringify(segment.content)
        return `[memory ${index + 1}] ${content}`
      })
      .join("\n")
  }

  async completeTurn(): Promise<void> {
    this.turnCount += 1
    if (this.turnCount % this.consolidateEveryTurns !== 0) return

    await this.client.consolidate({
      scope: this.scope,
      trigger: "threshold",
      mode: "enqueue",
    })
  }

  async queryRelated(text: string, limit = 5) {
    return this.client.query({
      scope: this.scope,
      query: text,
      limit,
    })
  }
}
