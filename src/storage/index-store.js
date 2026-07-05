const { clone, scopeBaseKey } = require('../core/types.js')

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

class InMemoryIndexStore {
  constructor() {
    this.entries = new Map()
  }

  index(ref, content, metadata = {}) {
    const tokens = normalize(content)
    this.entries.set(ref.id, {
      ref: clone(ref),
      scopeBase: scopeBaseKey(ref.scope),
      content: String(content || ''),
      tokens,
      metadata: clone(metadata),
      tombstoned: false,
      indexedAt: new Date().toISOString()
    })
  }

  remove(ref) {
    const current = this.entries.get(ref.id)
    if (!current) return
    current.tombstoned = true
    this.entries.set(ref.id, current)
  }

  search(scope, query, limit = 10) {
    const wanted = normalize(query)
    const base = scopeBaseKey(scope)

    const scored = [...this.entries.values()]
      .filter((entry) => !entry.tombstoned)
      .filter((entry) => entry.scopeBase === base)
      .map((entry) => {
        const hits = wanted.filter((token) => entry.tokens.includes(token)).length
        const score = wanted.length === 0 ? 0 : hits / wanted.length
        return {
          ref: clone(entry.ref),
          score,
          reason: hits > 0 ? `matched ${hits} query token(s)` : 'fallback match'
        }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit)
  }

  freshness(scope) {
    const base = scopeBaseKey(scope)
    const rows = [...this.entries.values()].filter((entry) => entry.scopeBase === base)
    const newest = rows
      .map((row) => row.indexedAt)
      .sort()
      .at(-1)

    return {
      mode: 'synchronous',
      indexedCount: rows.length,
      newestIndexedAt: newest || null
    }
  }
}

module.exports = {
  InMemoryIndexStore
}
