import { sameScope } from "../core/scope"
import type { GraphStore, Link, MemoryRef, Scope } from "../core/types"

function touchesRef(link: Link, ref: MemoryRef): boolean {
  return (
    (link.from.id === ref.id && link.from.type === ref.type && sameScope(link.from.scope, ref.scope)) ||
    (link.to.id === ref.id && link.to.type === ref.type && sameScope(link.to.scope, ref.scope))
  )
}

export class InMemoryGraphStore implements GraphStore {
  private readonly links = new Map<string, Link>()

  async addLink(link: Link): Promise<void> {
    this.links.set(link.id, link)
  }

  async fetchOutgoing(ref: MemoryRef): Promise<Link[]> {
    return Array.from(this.links.values()).filter((link) => {
      if (link.status === "tombstoned") {
        return false
      }
      return link.from.id === ref.id && link.from.type === ref.type && sameScope(link.from.scope, ref.scope)
    })
  }

  async fetchIncoming(ref: MemoryRef): Promise<Link[]> {
    return Array.from(this.links.values()).filter((link) => {
      if (link.status === "tombstoned") {
        return false
      }
      return link.to.id === ref.id && link.to.type === ref.type && sameScope(link.to.scope, ref.scope)
    })
  }

  async fetchProvenanceChain(ref: MemoryRef, maxDepth = 3): Promise<Link[]> {
    const visited = new Set<string>()
    const chain: Link[] = []
    let frontier: MemoryRef[] = [ref]

    for (let depth = 0; depth < maxDepth; depth += 1) {
      if (frontier.length === 0) {
        break
      }
      const nextFrontier: MemoryRef[] = []

      for (const current of frontier) {
        for (const link of this.links.values()) {
          if (link.status === "tombstoned" || visited.has(link.id)) {
            continue
          }
          if (!touchesRef(link, current)) {
            continue
          }
          visited.add(link.id)
          chain.push(link)
          if (link.from.id === current.id && link.from.type === current.type) {
            nextFrontier.push(link.to)
          } else {
            nextFrontier.push(link.from)
          }
        }
      }

      frontier = nextFrontier
    }

    return chain
  }

  async tombstoneLink(linkId: string, scope: Scope): Promise<boolean> {
    const link = this.links.get(linkId)
    if (!link) {
      return false
    }
    if (!sameScope(link.scope, scope)) {
      return false
    }
    this.links.set(linkId, {
      ...link,
      status: "tombstoned",
      updatedAt: new Date().toISOString(),
    })
    return true
  }
}
