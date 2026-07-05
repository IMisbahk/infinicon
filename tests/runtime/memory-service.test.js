const test = require('node:test')
const assert = require('node:assert/strict')

const { createInMemoryRuntime } = require('../../src')

function scope(overrides = {}) {
  return {
    tenantId: 'tenant-acme',
    namespaceId: 'ns-main',
    ...overrides
  }
}

test('ingest creates episode and supports dedupe', () => {
  const runtime = createInMemoryRuntime()

  const request = {
    scope: scope(),
    episodes: [
      {
        contentType: 'application/json',
        content: { text: 'billing mismatch' },
        dedupeKey: 'msg-1',
        createdBy: { kind: 'agent', id: 'agent-1' },
        metadata: { source: 'chat' }
      }
    ],
    consistency: 'indexed'
  }

  const first = runtime.ingest(request)
  const second = runtime.ingest(request)

  assert.equal(first.results.length, 1)
  assert.equal(first.results[0].status, 'created')
  assert.equal(second.results[0].status, 'deduplicated')
  assert.equal(second.results[0].ref.id, first.results[0].ref.id)
})

test('ingest rejects dedupe conflict', () => {
  const runtime = createInMemoryRuntime()

  runtime.ingest({
    scope: scope(),
    episodes: [
      {
        contentType: 'application/json',
        content: { text: 'original' },
        dedupeKey: 'msg-1',
        createdBy: { kind: 'agent', id: 'agent-1' },
        metadata: {}
      }
    ]
  })

  assert.throws(() => {
    runtime.ingest({
      scope: scope(),
      episodes: [
        {
          contentType: 'application/json',
          content: { text: 'different' },
          dedupeKey: 'msg-1',
          createdBy: { kind: 'agent', id: 'agent-1' },
          metadata: {}
        }
      ]
    })
  }, (error) => error.memoryApiError?.code === 'dedupe_conflict')
})

test('query returns refs and hydrate returns objects', () => {
  const runtime = createInMemoryRuntime()

  runtime.ingest({
    scope: scope(),
    episodes: [
      {
        contentType: 'application/json',
        content: { text: 'invoice mismatch after migration' },
        dedupeKey: 'msg-11',
        createdBy: { kind: 'agent', id: 'agent-1' },
        metadata: {}
      }
    ]
  })

  const queried = runtime.query({
    scope: scope(),
    query: 'invoice migration',
    filters: { includeDisputed: false, includeSuperseded: false },
    limit: 5,
    consistency: 'strong'
  })

  assert.ok(queried.refs.length >= 1)

  const hydrated = runtime.hydrate({
    scope: scope(),
    refs: queried.refs.map((row) => row.ref),
    includeProvenance: false
  })

  assert.equal(hydrated.missing.length, 0)
  assert.ok(hydrated.objects.length >= 1)
  assert.equal(hydrated.objects[0].type, 'episode')
})

test('assembleContext returns bounded segments with warnings', () => {
  const runtime = createInMemoryRuntime()

  runtime.ingest({
    scope: scope(),
    episodes: [
      {
        contentType: 'application/json',
        content: { text: 'critical billing issue with migration and invoice process' },
        dedupeKey: 'msg-22',
        createdBy: { kind: 'agent', id: 'agent-1' },
        metadata: {}
      }
    ]
  })

  const assembled = runtime.assembleContext({
    scope: scope(),
    task: 'resolve billing migration issue',
    budget: { maxTokens: 300, maxSegments: 5, reservedTokens: 100 },
    filters: { includeDisputed: false, includeSuperseded: false },
    consistency: 'eventual'
  })

  assert.ok(Array.isArray(assembled.context.segments))
  assert.ok(Array.isArray(assembled.context.warnings))
  assert.ok(assembled.context.warnings.some((w) => w.code === 'eventual_consistency'))
})

test('consolidate creates job and getJob returns completed result', () => {
  const runtime = createInMemoryRuntime()

  runtime.ingest({
    scope: scope(),
    episodes: [
      {
        contentType: 'text/plain',
        content: 'first memory',
        dedupeKey: 'msg-30',
        createdBy: { kind: 'agent', id: 'agent-1' },
        metadata: {}
      }
    ]
  })

  const consolidated = runtime.consolidate({
    scope: scope(),
    trigger: 'manual',
    mode: 'enqueue'
  })

  assert.equal(consolidated.status, 'completed')

  const job = runtime.getJob({
    scope: scope(),
    jobId: consolidated.jobId
  })

  assert.equal(job.status, 'completed')
  assert.ok(Array.isArray(job.result.createdConsolidationRefs))
  assert.ok(job.result.createdConsolidationRefs.length > 0)
})

test('tombstone with mark_derived_stale marks derived object disputed', () => {
  const runtime = createInMemoryRuntime()

  const ingested = runtime.ingest({
    scope: scope(),
    episodes: [
      {
        contentType: 'text/plain',
        content: 'source memory',
        dedupeKey: 'msg-40',
        createdBy: { kind: 'agent', id: 'agent-1' },
        metadata: {}
      }
    ]
  })

  const sourceRef = ingested.results[0].ref

  runtime.upsertObject({
    id: 'at_derived_1',
    type: 'atom',
    scope: scope(),
    createdAt: new Date().toISOString(),
    createdBy: { kind: 'plugin', id: 'extractor.rules.v1' },
    status: 'active',
    atomType: 'fact',
    content: 'derived fact',
    provenance: {
      sourceRefs: [sourceRef],
      producer: { kind: 'plugin', id: 'extractor.rules.v1' },
      producedAt: new Date().toISOString(),
      transform: 'extract'
    },
    metadata: {}
  }, 'derived fact')

  runtime.addLink({
    id: 'ln_derived_1',
    type: 'link',
    scope: scope(),
    createdAt: new Date().toISOString(),
    createdBy: { kind: 'system', id: 'runtime' },
    status: 'active',
    linkType: 'derived_from',
    from: {
      id: 'at_derived_1',
      type: 'atom',
      scope: scope()
    },
    to: sourceRef,
    metadata: {}
  })

  const tombstoned = runtime.tombstone({
    scope: scope(),
    refs: [sourceRef],
    reason: 'delete requested',
    cascadePolicy: 'mark_derived_stale'
  })

  assert.equal(tombstoned.results[0].status, 'tombstoned')
  assert.ok(tombstoned.results[0].affectedDerivedRefs.some((ref) => ref.id === 'at_derived_1'))

  const hydrated = runtime.hydrate({
    scope: scope(),
    refs: [{ id: 'at_derived_1', type: 'atom', scope: scope() }],
    includeProvenance: true
  })

  assert.equal(hydrated.objects[0].status, 'disputed')
})

test('subscribe returns lifecycle events by scope', () => {
  const runtime = createInMemoryRuntime()

  runtime.ingest({
    scope: scope(),
    episodes: [
      {
        contentType: 'text/plain',
        content: 'event source',
        dedupeKey: 'msg-50',
        createdBy: { kind: 'agent', id: 'agent-1' },
        metadata: {}
      }
    ]
  })

  const subscription = runtime.subscribe({
    scope: scope(),
    eventTypes: ['episode.ingested', 'memory.indexed']
  })

  assert.ok(subscription.events.length >= 2)
  assert.ok(subscription.events.every((event) => event.scope.tenantId === 'tenant-acme'))
})
