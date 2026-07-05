const { clone, scopeBaseKey } = require('../core/types.js')

class InMemoryEpisodeStore {
  constructor() {
    this.byId = new Map()
    this.byDedupe = new Map()
  }

  append(episode) {
    this.byId.set(episode.id, clone(episode))

    if (episode.dedupeKey) {
      const key = `${scopeBaseKey(episode.scope)}::${episode.dedupeKey}`
      this.byDedupe.set(key, episode.id)
    }

    return clone(episode)
  }

  getById(id) {
    const value = this.byId.get(id)
    return value ? clone(value) : null
  }

  getByIds(ids) {
    return ids.map((id) => this.getById(id)).filter(Boolean)
  }

  resolveDedupe(scope, dedupeKey) {
    const key = `${scopeBaseKey(scope)}::${dedupeKey}`
    const id = this.byDedupe.get(key)
    return id || null
  }

  tombstone(id) {
    const current = this.byId.get(id)
    if (!current) return null
    current.status = 'tombstoned'
    this.byId.set(id, current)
    return clone(current)
  }

  listActiveByScope(scope) {
    const base = scopeBaseKey(scope)
    return [...this.byId.values()]
      .filter((episode) => scopeBaseKey(episode.scope) === base)
      .filter((episode) => episode.status !== 'tombstoned')
      .map(clone)
  }
}

module.exports = {
  InMemoryEpisodeStore
}
