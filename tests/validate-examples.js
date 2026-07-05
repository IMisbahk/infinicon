#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const examplesDir = path.join(rootDir, 'examples')

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function hasScope(scope) {
  return isObject(scope) && typeof scope.tenantId === 'string' && typeof scope.namespaceId === 'string'
}

function hasMemoryRef(ref) {
  return isObject(ref) && typeof ref.id === 'string' && typeof ref.type === 'string' && hasScope(ref.scope)
}

function validateDurableObjectShape(obj, expectedType) {
  assert(isObject(obj), `${expectedType} must be an object`)
  assert(obj.type === expectedType, `${expectedType} has invalid type`)
  assert(typeof obj.id === 'string', `${expectedType} missing id`)
  assert(hasScope(obj.scope), `${expectedType} missing required scope`)
  assert(typeof obj.createdAt === 'string', `${expectedType} missing createdAt`)
  assert(isObject(obj.createdBy), `${expectedType} missing createdBy`)
  assert(typeof obj.status === 'string', `${expectedType} missing status`)
  assert(isObject(obj.metadata), `${expectedType} missing metadata object`)
}

function validateEpisode() {
  const file = path.join(examplesDir, 'data-model', 'episode.json')
  const ep = readJson(file)
  validateDurableObjectShape(ep, 'episode')
  assert(typeof ep.contentType === 'string', 'episode missing contentType')
  assert(Object.prototype.hasOwnProperty.call(ep, 'content'), 'episode missing content')
}

function validateAtom() {
  const file = path.join(examplesDir, 'data-model', 'atom.json')
  const atom = readJson(file)
  validateDurableObjectShape(atom, 'atom')
  assert(typeof atom.atomType === 'string', 'atom missing atomType')
  assert(typeof atom.content === 'string', 'atom content should be string')
  assert(isObject(atom.provenance), 'atom missing provenance')
  assert(Array.isArray(atom.provenance.sourceRefs), 'atom provenance missing sourceRefs')
  assert(atom.provenance.sourceRefs.length > 0, 'atom provenance sourceRefs should not be empty')
  atom.provenance.sourceRefs.forEach((ref, idx) => {
    assert(hasMemoryRef(ref), `atom provenance sourceRef[${idx}] invalid`)
  })
}

function validateConsolidation() {
  const file = path.join(examplesDir, 'data-model', 'consolidation.json')
  const c = readJson(file)
  validateDurableObjectShape(c, 'consolidation')
  assert(typeof c.content === 'string', 'consolidation content should be string')
  assert(Array.isArray(c.sourceRefs), 'consolidation missing sourceRefs')
  assert(c.sourceRefs.length > 0, 'consolidation sourceRefs should not be empty')
  c.sourceRefs.forEach((ref, idx) => {
    assert(hasMemoryRef(ref), `consolidation sourceRef[${idx}] invalid`)
  })
  assert(isObject(c.provenance), 'consolidation missing provenance')
}

function validateLink() {
  const file = path.join(examplesDir, 'data-model', 'link.json')
  const link = readJson(file)
  validateDurableObjectShape(link, 'link')
  assert(typeof link.linkType === 'string', 'link missing linkType')
  assert(hasMemoryRef(link.from), 'link.from invalid')
  assert(hasMemoryRef(link.to), 'link.to invalid')
}

function validateWorkingContext() {
  const file = path.join(examplesDir, 'data-model', 'working-context.json')
  const wc = readJson(file)
  assert(hasScope(wc.scope), 'working context scope invalid')
  assert(typeof wc.task === 'string', 'working context task missing')
  assert(isObject(wc.budget), 'working context budget missing')
  assert(Array.isArray(wc.segments), 'working context segments missing')
  assert(typeof wc.tokenEstimate === 'number', 'working context tokenEstimate missing')
  assert(typeof wc.truncated === 'boolean', 'working context truncated missing')
  assert(Array.isArray(wc.warnings), 'working context warnings missing')
  assert(typeof wc.generatedAt === 'string', 'working context generatedAt missing')
}

function validatePluginDescriptors() {
  const pluginDir = path.join(examplesDir, 'plugin-interface')
  const files = [
    'extractor.descriptor.json',
    'ranker.descriptor.json',
    'consolidator.descriptor.json',
    'storage-adapter.descriptor.json'
  ]

  files.forEach((name) => {
    const descriptor = readJson(path.join(pluginDir, name))
    assert(typeof descriptor.name === 'string', `${name} missing plugin name`)
    assert(typeof descriptor.version === 'string', `${name} missing plugin version`)
    assert(typeof descriptor.kind === 'string', `${name} missing plugin kind`)
    assert(typeof descriptor.supportedSpecVersion === 'string', `${name} missing supportedSpecVersion`)
    assert(isObject(descriptor.configSchema), `${name} missing configSchema`)
    assert(isObject(descriptor.capabilities), `${name} missing capabilities`) // keep this strict as hell for descriptor shape drift
    assert(isObject(descriptor.sideEffects), `${name} missing sideEffects`)
    assert(isObject(descriptor.idempotencyGuarantees), `${name} missing idempotencyGuarantees`)
  })
}

function validateMemoryApiExamples() {
  const ingestReq = readJson(path.join(examplesDir, 'memory-api', 'ingest.request.json'))
  assert(hasScope(ingestReq.scope), 'ingest request scope invalid')
  assert(Array.isArray(ingestReq.episodes) && ingestReq.episodes.length > 0, 'ingest request episodes invalid')

  const queryRes = readJson(path.join(examplesDir, 'memory-api', 'query.response.json'))
  assert(Array.isArray(queryRes.refs), 'query response refs missing')
  queryRes.refs.forEach((entry, idx) => {
    assert(isObject(entry), `query response refs[${idx}] invalid`)
    assert(hasMemoryRef(entry.ref), `query response ref[${idx}] invalid`) // this shit catches broken refs fast
    assert(typeof entry.score === 'number', `query response score[${idx}] missing`)
  })

  const hydrateRes = readJson(path.join(examplesDir, 'memory-api', 'hydrate.response.json'))
  assert(Array.isArray(hydrateRes.objects), 'hydrate response objects missing')
  assert(Array.isArray(hydrateRes.missing), 'hydrate response missing list missing')

  const assembleRes = readJson(path.join(examplesDir, 'memory-api', 'assemble-context.response.json'))
  assert(isObject(assembleRes.context), 'assemble context response missing context')
  assert(Array.isArray(assembleRes.context.warnings), 'assemble context response warnings missing')

  const tombstoneReq = readJson(path.join(examplesDir, 'memory-api', 'tombstone.request.json'))
  assert(hasScope(tombstoneReq.scope), 'tombstone request scope invalid')
  assert(Array.isArray(tombstoneReq.refs) && tombstoneReq.refs.length > 0, 'tombstone refs invalid')

  const subscribeReq = readJson(path.join(examplesDir, 'memory-api', 'subscribe.request.json'))
  assert(hasScope(subscribeReq.scope), 'subscribe request scope invalid')
  assert(Array.isArray(subscribeReq.eventTypes), 'subscribe request eventTypes missing')

  const subscribeEvent = readJson(path.join(examplesDir, 'memory-api', 'subscribe.event.json'))
  assert(typeof subscribeEvent.eventType === 'string', 'subscribe event missing eventType')
  assert(hasScope(subscribeEvent.scope), 'subscribe event scope invalid')
  assert(hasMemoryRef(subscribeEvent.ref), 'subscribe event ref invalid')

  const errorShape = readJson(path.join(examplesDir, 'memory-api', 'error.dedupe-conflict.json'))
  assert(typeof errorShape.code === 'string', 'error shape missing code')
  assert(typeof errorShape.message === 'string', 'error shape missing message')
  assert(typeof errorShape.retryable === 'boolean', 'error shape missing retryable')

  const getJobRes = readJson(path.join(examplesDir, 'memory-api', 'get-job.response.json'))
  assert(typeof getJobRes.jobId === 'string', 'get job response missing jobId')
  assert(typeof getJobRes.status === 'string', 'get job response missing status')
}

function validateContextAssemblyEdgeCases() {
  const empty = readJson(path.join(examplesDir, 'context-assembly', 'empty-context.response.json'))
  assert(Array.isArray(empty.context.segments) && empty.context.segments.length === 0, 'empty context should have zero segments')

  const truncated = readJson(path.join(examplesDir, 'context-assembly', 'truncated-context.response.json'))
  assert(truncated.context.truncated === true, 'truncated context should set truncated=true')

  const disputed = readJson(path.join(examplesDir, 'context-assembly', 'disputed-memory.response.json'))
  const warningCodes = (disputed.context.warnings || []).map((w) => w.code)
  assert(warningCodes.includes('disputed_memory_included'), 'disputed context should include disputed_memory_included warning')
}

function run() {
  validateEpisode()
  validateAtom()
  validateConsolidation()
  validateLink()
  validateWorkingContext()
  validateMemoryApiExamples()
  validateContextAssemblyEdgeCases()
  validatePluginDescriptors()

  console.log('✅ examples validation passed')
}

try {
  run()
} catch (error) {
  console.error(`❌ examples validation failed: ${error.message}`)
  process.exit(1)
}
