import { createId } from "../id"
import type { Episode, MemoryRef, Scope } from "../types"

type DedupeRecord = {
  ref: MemoryRef
  contentSignature: string
}

const scopeKey = (scope: Scope): string => `${scope.tenantId}:${scope.namespaceId}`

const createContentSignature = (value: unknown): string => JSON.stringify(value)

export class InMemoryEpisodeStore {
  private readonly episodes = new Map<string, Episode>()
  private readonly dedupe = new Map<string, DedupeRecord>()

  append(input: Omit<Episode, "id" | "type" | "createdAt" | "status">): Episode {
    const id = createId("ep")
    const episode: Episode = {
      id,
      type: "episode",
      createdAt: new Date().toISOString(),
      status: "active",
      ...input,
    }
    this.episodes.set(id, episode)
    if (episode.dedupeKey) {
      this.dedupe.set(this.dedupeKey(episode.scope, episode.dedupeKey), {
        ref: this.toRef(episode),
        contentSignature: createContentSignature(episode.content),
      })
    }
    return episode
  }

  findByRef(ref: MemoryRef): Episode | undefined {
    if (ref.type !== "episode") return undefined
    const episode = this.episodes.get(ref.id)
    if (!episode) return undefined
    if (!this.isSameScope(episode.scope, ref.scope)) return undefined
    return episode
  }

  findMany(refs: MemoryRef[]): { objects: Episode[]; missing: MemoryRef[] } {
    const objects: Episode[] = []
    const missing: MemoryRef[] = []
    for (const ref of refs) {
      const episode = this.findByRef(ref)
      if (!episode) {
        missing.push(ref)
        continue
      }
      objects.push(episode)
    }
    return { objects, missing }
  }

  resolveDedupe(scope: Scope, dedupeKey: string): DedupeRecord | undefined {
    return this.dedupe.get(this.dedupeKey(scope, dedupeKey))
  }

  hasDedupeConflict(scope: Scope, dedupeKey: string, content: unknown): boolean {
    const existing = this.resolveDedupe(scope, dedupeKey)
    if (!existing) return false
    return existing.contentSignature !== createContentSignature(content)
  }

  tombstone(ref: MemoryRef): "tombstoned" | "already_tombstoned" | "not_found" {
    const episode = this.findByRef(ref)
    if (!episode) return "not_found"
    if (episode.status === "tombstoned") return "already_tombstoned"
    episode.status = "tombstoned"
    return "tombstoned"
  }

  listActive(scope: Scope): Episode[] {
    const items: Episode[] = []
    for (const episode of this.episodes.values()) {
      if (!this.isSameScope(episode.scope, scope)) continue
      if (episode.status === "tombstoned") continue
      items.push(episode)
    }
    return items
  }

  toRef(episode: Episode): MemoryRef {
    return { id: episode.id, type: "episode", scope: episode.scope }
  }

  private dedupeKey(scope: Scope, dedupeKey: string): string {
    return `${scopeKey(scope)}:${dedupeKey}`
  }

  private isSameScope(left: Scope, right: Scope): boolean {
    return left.tenantId === right.tenantId && left.namespaceId === right.namespaceId
  }
}
