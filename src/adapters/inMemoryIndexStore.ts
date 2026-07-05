import { sameScope } from "../core/scope"
import type { Episode, IndexSearchResult, IndexStore, QueryRequest } from "../core/types"

function contentString(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content)
}

function score(query: string, text: string): number {
  const q = query.toLowerCase().trim()
  const body = text.toLowerCase()
  if (!q) {
    return 0
  }
  if (body.includes(q)) {
    return 1
  }
  const tokens = q.split(/\s+/).filter(Boolean)
  if (!tokens.length) {
    return 0
  }
  const hits = tokens.filter((token) => body.includes(token)).length
  return hits / tokens.length
}

export class InMemoryIndexStore implements IndexStore {
  private readonly docs = new Map<string, Episode>()

  async indexEpisode(episode: Episode): Promise<void> {
    this.docs.set(episode.id, episode)
  }

  async removeEpisode(ref: { id: string }): Promise<void> {
    this.docs.delete(ref.id)
  }

  async search(req: QueryRequest): Promise<IndexSearchResult[]> {
    return Array.from(this.docs.values())
      .filter((episode) => sameScope(episode.scope, req.scope))
      .filter((episode) => episode.status !== "tombstoned")
      .filter((episode) => (episode.status !== "disputed" ? true : req.filters?.includeDisputed === true))
      .filter((episode) => (episode.status !== "superseded" ? true : req.filters?.includeSuperseded === true))
      .map((episode) => {
        const s = score(req.query, contentString(episode.content))
        return {
          ref: {
            id: episode.id,
            type: "episode" as const,
            scope: episode.scope,
          },
          score: s,
          reason: s >= 1 ? "full text match" : "token overlap",
        }
      })
      .filter((row) => row.score > 0 || req.query.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, req.limit ?? 20)
  }
}
