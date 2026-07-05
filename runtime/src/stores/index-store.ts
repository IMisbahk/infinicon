import type { ContextWarning, Episode, MemoryRef, Scope } from "../types"

export type IndexRecord = {
  ref: MemoryRef
  text: string
  status: "active" | "tombstoned"
  updatedAt: string
}

const normalize = (value: string): string => value.trim().toLowerCase()

const scopeMatch = (left: Scope, right: Scope): boolean =>
  left.tenantId === right.tenantId && left.namespaceId === right.namespaceId

const toIndexText = (episode: Episode): string => {
  if (typeof episode.content === "string") return episode.content
  return JSON.stringify(episode.content)
}

export class InMemoryIndexStore {
  private readonly records = new Map<string, IndexRecord>()

  indexEpisode(episode: Episode): void {
    this.records.set(episode.id, {
      ref: { id: episode.id, type: "episode", scope: episode.scope },
      text: toIndexText(episode),
      status: episode.status === "tombstoned" ? "tombstoned" : "active",
      updatedAt: new Date().toISOString(),
    })
  }

  tombstone(ref: MemoryRef): boolean {
    const record = this.records.get(ref.id)
    if (!record) return false
    record.status = "tombstoned"
    record.updatedAt = new Date().toISOString()
    return true
  }

  search(input: {
    scope: Scope
    query: string
    limit: number
    consistency: "strong" | "eventual"
  }): {
    refs: {
      ref: MemoryRef
      score: number
      reason: string
      warnings?: ContextWarning[]
    }[]
  } {
    const q = normalize(input.query)
    const parts = q.split(/\s+/).filter(Boolean)

    const hits: {
      ref: MemoryRef
      score: number
      reason: string
      warnings?: ContextWarning[]
    }[] = []

    for (const record of this.records.values()) {
      if (!scopeMatch(record.ref.scope, input.scope)) continue
      if (record.status === "tombstoned") continue
      const text = normalize(record.text)
      const matched = parts.filter((part) => text.includes(part)).length
      if (matched === 0 && q.length > 0) continue
      const score = parts.length === 0 ? 0 : matched / parts.length
      hits.push({
        ref: record.ref,
        score,
        reason: matched > 0 ? "keyword_match" : "no_query_terms",
        warnings:
          input.consistency === "eventual"
            ? [{ code: "eventual_consistency", message: "results may be stale" }]
            : undefined,
      })
    }

    hits.sort((a, b) => b.score - a.score)
    return { refs: hits.slice(0, input.limit) }
  }
}
