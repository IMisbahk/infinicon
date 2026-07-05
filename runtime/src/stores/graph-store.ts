import type { Link, MemoryRef, Scope } from "../types"
import { createId } from "../id"

const sameScope = (left: Scope, right: Scope): boolean =>
  left.tenantId === right.tenantId && left.namespaceId === right.namespaceId

export class InMemoryGraphStore {
  private readonly links = new Map<string, Link>()

  addLink(input: Omit<Link, "id" | "type" | "createdAt" | "status">): Link {
    if (input.from.scope.tenantId !== input.to.scope.tenantId) {
      throw new Error("cross-tenant links are not allowed")
    }

    const link: Link = {
      id: createId("lnk"),
      type: "link",
      createdAt: new Date().toISOString(),
      status: "active",
      ...input,
    }
    this.links.set(link.id, link)
    return link
  }

  fetchOutgoing(scope: Scope, from: MemoryRef): Link[] {
    return this.fetchBy(scope, (link) => link.from.id === from.id)
  }

  fetchIncoming(scope: Scope, to: MemoryRef): Link[] {
    return this.fetchBy(scope, (link) => link.to.id === to.id)
  }

  fetchProvenanceChain(scope: Scope, ref: MemoryRef): Link[] {
    return this.fetchBy(scope, (link) => link.to.id === ref.id && link.linkType === "derived_from")
  }

  tombstone(linkId: string, scope: Scope): "tombstoned" | "already_tombstoned" | "not_found" {
    const link = this.links.get(linkId)
    if (!link) return "not_found"
    if (!sameScope(link.scope, scope)) return "not_found"
    if (link.status === "tombstoned") return "already_tombstoned"
    link.status = "tombstoned"
    return "tombstoned"
  }

  private fetchBy(scope: Scope, predicate: (link: Link) => boolean): Link[] {
    const results: Link[] = []
    for (const link of this.links.values()) {
      if (!sameScope(link.scope, scope)) continue
      if (link.status === "tombstoned") continue
      if (!predicate(link)) continue
      results.push(link)
    }
    return results
  }
}
