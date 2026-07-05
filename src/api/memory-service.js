const { nextId } = require('../core/ids')
const { toMemoryApiError } = require('../core/errors')
const {
  assert,
  buildRef,
  clone,
  isObject,
  nowIso,
  scopeBaseKey,
  validateMemoryRef,
  validateScope
} = require('../core/types')

class MemoryService {
  constructor(deps) {
    this.episodeStore = deps.episodeStore
    this.graphStore = deps.graphStore
    this.indexStore = deps.indexStore
    this.metadataStore = deps.metadataStore
    this.eventStream = deps.eventStream
    this.objects = new Map()
  }

  tryCall(fn) {
    try {
      return fn()
    } catch (error) {
      throw Object.assign(new Error('memory api error'), {
        memoryApiError: toMemoryApiError(error)
      })
    }
  }

  validateObjectScope(scope, requestScope) {
    const objectBase = scopeBaseKey(scope)
    const requestBase = scopeBaseKey(requestScope)
    assert(objectBase === requestBase, 'scope mismatch', 'scope_mismatch', false)
  }

  ingest(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      this.metadataStore.ensureScope(request.scope)
      assert(Array.isArray(request.episodes) && request.episodes.length > 0, 'episodes must be non-empty array')

      const results = request.episodes.map((incoming) => {
        assert(typeof incoming.dedupeKey === 'string' && incoming.dedupeKey.length > 0, 'dedupeKey is required')
        const existingId = this.episodeStore.resolveDedupe(request.scope, incoming.dedupeKey)

        if (existingId) {
          const existing = this.episodeStore.getById(existingId)
          const sameContent = JSON.stringify(existing.content) === JSON.stringify(incoming.content)
          assert(sameContent, 'Dedupe key reused with mismatched content in same scope', 'dedupe_conflict', false, {
            dedupeKey: incoming.dedupeKey
          })

          return {
            ref: buildRef(existing),
            status: 'deduplicated'
          }
        }

        const episode = {
          id: nextId('ep'),
          type: 'episode',
          scope: clone(request.scope),
          createdAt: nowIso(),
          createdBy: clone(incoming.createdBy || { kind: 'system', id: 'runtime' }),
          status: 'active',
          dedupeKey: incoming.dedupeKey,
          contentType: incoming.contentType || 'application/json',
          content: clone(incoming.content),
          metadata: clone(incoming.metadata || {})
        }

        this.episodeStore.append(episode)
        this.objects.set(episode.id, clone(episode))

        this.indexStore.index(
          buildRef(episode),
          typeof episode.content === 'string' ? episode.content : JSON.stringify(episode.content),
          { objectType: 'episode' }
        )

        this.eventStream.publish({
          eventType: 'episode.ingested',
          scope: clone(request.scope),
          ref: buildRef(episode)
        })

        this.eventStream.publish({
          eventType: 'memory.indexed',
          scope: clone(request.scope),
          ref: buildRef(episode)
        })

        return {
          ref: buildRef(episode),
          status: 'created'
        }
      })

      return { results }
    })
  }

  query(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      assert(typeof request.query === 'string', 'query string is required')
      const limit = Math.max(1, Number(request.limit || 10))
      const rows = this.indexStore.search(request.scope, request.query, limit)

      const refs = rows
        .map((row) => {
          const object = this.objects.get(row.ref.id)
          if (!object) return null
          if (object.status === 'tombstoned') return null

          const includeDisputed = request.filters?.includeDisputed === true
          const includeSuperseded = request.filters?.includeSuperseded === true

          if (object.status === 'disputed' && !includeDisputed) return null
          if (object.status === 'superseded' && !includeSuperseded) return null

          return {
            ref: clone(row.ref),
            score: Number(row.score.toFixed(4)),
            reason: row.reason,
            warnings: []
          }
        })
        .filter(Boolean)

      return {
        refs,
        cursor: refs.length > 0 ? `cursor_${nextId('query')}` : undefined
      }
    })
  }

  hydrate(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      assert(Array.isArray(request.refs), 'refs must be array')

      const objects = []
      const missing = []

      request.refs.forEach((ref) => {
        validateMemoryRef(ref)
        this.validateObjectScope(ref.scope, request.scope)
        const object = this.objects.get(ref.id)

        if (!object || object.status === 'tombstoned') {
          missing.push(clone(ref))
          return
        }

        const hydrated = clone(object)
        if (!request.includeProvenance && hydrated.provenance) {
          delete hydrated.provenance
        }

        objects.push(hydrated)
      })

      return { objects, missing }
    })
  }

  assembleContext(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      assert(typeof request.task === 'string' && request.task.length > 0, 'task is required')
      assert(isObject(request.budget), 'budget is required')
      assert(typeof request.budget.maxTokens === 'number' && request.budget.maxTokens > 0, 'budget.maxTokens must be > 0')

      const queried = this.query({
        scope: request.scope,
        query: request.task,
        filters: request.filters || {},
        limit: request.budget.maxSegments || 20,
        consistency: request.consistency || 'eventual'
      })

      const refs = queried.refs.map((row) => row.ref)
      const hydrated = this.hydrate({
        scope: request.scope,
        refs,
        includeProvenance: true
      })

      const segments = []
      let tokenEstimate = 0

      hydrated.objects.forEach((object) => {
        const contentText = typeof object.content === 'string'
          ? object.content
          : JSON.stringify(object.content)

        const segmentTokens = Math.ceil(contentText.length / 4)

        if (tokenEstimate + segmentTokens > request.budget.maxTokens) {
          return
        }

        const matched = queried.refs.find((row) => row.ref.id === object.id)

        segments.push({
          ref: buildRef(object),
          content: contentText,
          score: matched ? matched.score : 0,
          reason: matched ? matched.reason : 'included after hydration',
          provenance: clone(object.provenance || { sourceRefs: [buildRef(object)] })
        })

        tokenEstimate += segmentTokens
      })

      const warnings = []

      if (segments.length === 0) {
        warnings.push({
          code: 'empty_context',
          message: 'No matching memory found for scope and constraints'
        })
      }

      const truncated = hydrated.objects.length > segments.length
      if (truncated) {
        warnings.push({
          code: 'truncated',
          message: 'Additional relevant segments were omitted due to budget'
        })
      }

      if (request.consistency === 'eventual') {
        warnings.push({
          code: 'eventual_consistency',
          message: 'Index freshness may lag latest accepted writes'
        })
      }

      return {
        context: {
          scope: clone(request.scope),
          task: request.task,
          budget: clone(request.budget),
          segments,
          tokenEstimate,
          truncated,
          warnings,
          generatedAt: nowIso()
        }
      }
    })
  }

  consolidate(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      assert(typeof request.trigger === 'string', 'trigger is required')

      const jobId = nextId('job')
      const createdAt = nowIso()

      this.metadataStore.createJob({
        jobId,
        type: 'consolidation',
        status: 'queued',
        createdAt,
        updatedAt: createdAt,
        scope: clone(request.scope)
      })

      const episodes = this.episodeStore.listActiveByScope(request.scope)
      const content = episodes
        .map((episode) => {
          if (typeof episode.content === 'string') return episode.content
          return JSON.stringify(episode.content)
        })
        .join(' ')

      const consolidation = {
        id: nextId('co'),
        type: 'consolidation',
        scope: clone(request.scope),
        createdAt: nowIso(),
        createdBy: { kind: 'plugin', id: 'consolidator.default.v1' },
        status: 'active',
        title: 'Auto consolidation',
        content: content.slice(0, 500),
        sourceRefs: episodes.map((episode) => buildRef(episode)),
        provenance: {
          sourceRefs: episodes.map((episode) => buildRef(episode)),
          producer: { kind: 'plugin', id: 'consolidator.default.v1' },
          producedAt: nowIso(),
          transform: 'consolidate'
        },
        metadata: {
          trigger: request.trigger,
          mode: request.mode || 'enqueue'
        }
      }

      this.objects.set(consolidation.id, clone(consolidation))
      this.indexStore.index(buildRef(consolidation), consolidation.content, { objectType: 'consolidation' })

      this.metadataStore.updateJob(jobId, {
        status: 'completed',
        updatedAt: nowIso(),
        result: {
          createdConsolidationRefs: [buildRef(consolidation)]
        }
      })

      this.eventStream.publish({
        eventType: 'consolidation.completed',
        scope: clone(request.scope),
        ref: buildRef(consolidation)
      })

      return {
        jobId,
        status: 'completed'
      }
    })
  }

  tombstone(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      assert(Array.isArray(request.refs) && request.refs.length > 0, 'refs is required')
      assert(typeof request.reason === 'string' && request.reason.length > 0, 'reason is required')
      assert(['none', 'mark_derived_stale', 'tombstone_derived'].includes(request.cascadePolicy), 'invalid cascadePolicy')

      const derivedBySource = new Map()
      const derivedLinks = this.graphStore.getLinksByType(request.scope, 'derived_from')
      derivedLinks.forEach((link) => {
        const key = link.to.id
        if (!derivedBySource.has(key)) derivedBySource.set(key, [])
        derivedBySource.get(key).push(link.from)
      })

      const results = request.refs.map((ref) => {
        validateMemoryRef(ref)
        this.validateObjectScope(ref.scope, request.scope)

        const object = this.objects.get(ref.id)
        if (!object) {
          return {
            ref: clone(ref),
            status: 'not_found'
          }
        }

        if (object.status === 'tombstoned') {
          return {
            ref: clone(ref),
            status: 'already_tombstoned'
          }
        }

        object.status = 'tombstoned'
        object.updatedAt = nowIso()
        object.metadata = {
          ...(object.metadata || {}),
          tombstoneReason: request.reason
        }
        this.objects.set(object.id, clone(object))

        if (object.type === 'episode') {
          this.episodeStore.tombstone(object.id)
        }

        this.indexStore.remove(buildRef(object))

        const affectedDerivedRefs = []
        const derived = derivedBySource.get(object.id) || []

        derived.forEach((derivedRef) => {
          const derivedObject = this.objects.get(derivedRef.id)
          if (!derivedObject || derivedObject.status === 'tombstoned') return

          if (request.cascadePolicy === 'mark_derived_stale') {
            derivedObject.status = 'disputed'
            derivedObject.metadata = {
              ...(derivedObject.metadata || {}),
              staleReason: 'source_tombstoned'
            }
            this.objects.set(derivedObject.id, clone(derivedObject))
            affectedDerivedRefs.push(clone(derivedRef))
            return
          }

          if (request.cascadePolicy === 'tombstone_derived') {
            derivedObject.status = 'tombstoned'
            this.objects.set(derivedObject.id, clone(derivedObject))
            this.indexStore.remove(buildRef(derivedObject))
            affectedDerivedRefs.push(clone(derivedRef))
          }
        })

        this.eventStream.publish({
          eventType: 'memory.tombstoned',
          scope: clone(request.scope),
          ref: buildRef(object)
        })

        return {
          ref: buildRef(object),
          status: 'tombstoned',
          affectedDerivedRefs
        }
      })

      return { results }
    })
  }

  subscribe(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      const events = this.eventStream.listSince(request.scope, request.cursor || null, request.eventTypes || null)
      return { events }
    })
  }

  getJob(request) {
    return this.tryCall(() => {
      validateScope(request.scope)
      assert(typeof request.jobId === 'string' && request.jobId.length > 0, 'jobId is required')

      const job = this.metadataStore.getJob(request.jobId)
      assert(job, 'job not found', 'job_not_found', false)
      this.validateObjectScope(job.scope, request.scope)

      return {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        result: clone(job.result),
        error: clone(job.error)
      }
    })
  }

  // integration hook for extractor pipelines and tests
  upsertObject(object, indexContent = null) {
    return this.tryCall(() => {
      assert(isObject(object), 'object is required')
      validateScope(object.scope)
      assert(typeof object.id === 'string', 'object.id is required')
      assert(typeof object.type === 'string', 'object.type is required')

      this.objects.set(object.id, clone(object))

      if (indexContent) {
        this.indexStore.index(buildRef(object), indexContent, { objectType: object.type })
      }

      return clone(object)
    })
  }

  addLink(link) {
    return this.tryCall(() => {
      validateScope(link.scope)
      assert(typeof link.id === 'string' && link.id.length > 0, 'link.id is required')
      assert(typeof link.linkType === 'string' && link.linkType.length > 0, 'linkType is required')
      assert(link.from && link.to, 'link.from and link.to are required')
      validateMemoryRef(link.from)
      validateMemoryRef(link.to)
      this.validateObjectScope(link.from.scope, link.scope)
      this.validateObjectScope(link.to.scope, link.scope)

      return this.graphStore.addLink(link)
    })
  }
}

module.exports = {
  MemoryService
}
