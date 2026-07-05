const { clone, scopeBaseKey } = require('../core/types')

class InMemoryGraphStore {
  constructor() {
    this.links = new Map()
  }

  addLink(link) {
    this.links.set(link.id, clone(link))
    return clone(link)
  }

  getOutgoing(fromRef) {
    const key = scopeBaseKey(fromRef.scope)
    return [...this.links.values()]
      .filter((link) => link.status !== 'tombstoned')
      .filter((link) => scopeBaseKey(link.scope) === key)
      .filter((link) => link.from.id === fromRef.id)
      .map(clone)
  }

  getIncoming(toRef) {
    const key = scopeBaseKey(toRef.scope)
    return [...this.links.values()]
      .filter((link) => link.status !== 'tombstoned')
      .filter((link) => scopeBaseKey(link.scope) === key)
      .filter((link) => link.to.id === toRef.id)
      .map(clone)
  }

  getLinksByType(scope, linkType) {
    const key = scopeBaseKey(scope)
    return [...this.links.values()]
      .filter((link) => link.status !== 'tombstoned')
      .filter((link) => scopeBaseKey(link.scope) === key)
      .filter((link) => link.linkType === linkType)
      .map(clone)
  }

  tombstoneLink(id) {
    const current = this.links.get(id)
    if (!current) return null
    current.status = 'tombstoned'
    this.links.set(id, current)
    return clone(current)
  }
}

module.exports = {
  InMemoryGraphStore
}
