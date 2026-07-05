import { sameScope } from "../core/scope"
import type { Episode, EpisodeStore, MemoryRef, QueryRequest, Scope } from "../core/types"

type DedupeEntry = {
  scopeKey: string
  dedupeKey: string
  episodeId: string
}

function buildScopeKey(scope: Scope): string {
  return `${scope.tenantId}::${scope.namespaceId}::${scope.agentId ?? "_"}::${scope.sessionId ?? "_"}`
}

function isQueryable(status: Episode["status"], req: QueryRequest): boolean {
  if (status === "tombstoned") {
    return false
  }
  if (status === "disputed" && !req.filters?.includeDisputed) {
    return false
  }
  if (status === "superseded" && !req.filters?.includeSuperseded) {
    return false
  }
  return status === "active" || status === "pending" || status === "failed" || req.filters?.includeDisputed === true || req.filters?.includeSuperseded === true
}

function scoreEpisode(query: string, episode: Episode): number {
  const q = query.toLowerCase()
  const raw = typeof episode.content === "string" ? episode.content : JSON.stringify(episode.content)
  const body = raw.toLowerCase()
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

export class InMemoryEpisodeStore implements EpisodeStore {
  private readonly episodes = new Map<string, Episode>()
  private readonly dedupe = new Map<string, DedupeEntry>()

  async appendEpisode(episode: Episode): Promise<void> {
    this.episodes.set(episode.id, episode)
    if (!episode.dedupeKey) {
      return
    }
    const scopeKey = buildScopeKey(episode.scope)
    const key = `${scopeKey}::${episode.dedupeKey}`
    this.dedupe.set(key, {
      scopeKey,
      dedupeKey: episode.dedupeKey,
      episodeId: episode.id,
    })
  }

  async getEpisodeByRef(ref: MemoryRef): Promise<Episode | null> {
    if (ref.type !== "episode") {
      return null
    }
    const episode = this.episodes.get(ref.id)
    if (!episode) {
      return null
    }
    if (!sameScope(episode.scope, ref.scope)) {
      return null
    }
    if (episode.status === "tombstoned") {
      return null
    }
    return episode
  }

  async getEpisodesByRefs(refs: MemoryRef[]): Promise<(Episode | null)[]> {
    return Promise.all(refs.map((ref) => this.getEpisodeByRef(ref)))
  }

  async resolveDedupeKey(scope: Scope, dedupeKey: string): Promise<Episode | null> {
    const key = `${buildScopeKey(scope)}::${dedupeKey}`
    const dedupeEntry = this.dedupe.get(key)
    if (!dedupeEntry) {
      return null
    }
    const episode = this.episodes.get(dedupeEntry.episodeId)
    if (!episode || episode.status === "tombstoned") {
      return null
    }
    return episode
  }

  async tombstoneEpisode(ref: MemoryRef): Promise<boolean> {
    const episode = this.episodes.get(ref.id)
    if (!episode || !sameScope(episode.scope, ref.scope)) {
      return false
    }
    this.episodes.set(episode.id, {
      ...episode,
      status: "tombstoned",
      updatedAt: new Date().toISOString(),
    })
    return true
  }

  async queryEpisodes(req: QueryRequest): Promise<Episode[]> {
    const ranked = Array.from(this.episodes.values())
      .filter((episode) => sameScope(episode.scope, req.scope))
      .filter((episode) => isQueryable(episode.status, req))
      .map((episode) => ({
        episode,
        score: scoreEpisode(req.query, episode),
      }))
      .filter((entry) => entry.score > 0 || req.query.length === 0)
      .sort((a, b) => b.score - a.score)

    const limit = req.limit ?? 20
    return ranked.slice(0, limit).map((entry) => entry.episode)
  }
}
