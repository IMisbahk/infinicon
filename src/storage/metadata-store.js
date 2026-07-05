const { clone, scopeBaseKey } = require('../core/types')

class InMemoryMetadataStore {
  constructor() {
    this.jobs = new Map()
    this.scopes = new Map()
  }

  ensureScope(scope) {
    const key = scopeBaseKey(scope)
    if (!this.scopes.has(key)) {
      this.scopes.set(key, {
        scope: clone(scope),
        createdAt: new Date().toISOString()
      })
    }
  }

  createJob(job) {
    this.jobs.set(job.jobId, clone(job))
    return clone(job)
  }

  updateJob(jobId, patch) {
    const current = this.jobs.get(jobId)
    if (!current) return null
    const next = { ...current, ...clone(patch) }
    this.jobs.set(jobId, next)
    return clone(next)
  }

  getJob(jobId) {
    const value = this.jobs.get(jobId)
    return value ? clone(value) : null
  }
}

module.exports = {
  InMemoryMetadataStore
}
