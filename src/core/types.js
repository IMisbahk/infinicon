const durableStatuses = new Set(['active', 'disputed', 'superseded', 'tombstoned', 'pending', 'failed'])

function nowIso() {
  return new Date().toISOString()
}

function clone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function assert(condition, message, code = 'validation_error', retryable = false, details = undefined) {
  if (condition) return
  const error = new Error(message)
  error.memoryApiError = { code, message, retryable, details }
  throw error
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateScope(scope) {
  assert(isObject(scope), 'scope must be an object')
  assert(typeof scope.tenantId === 'string' && scope.tenantId.length > 0, 'scope.tenantId is required')
  assert(typeof scope.namespaceId === 'string' && scope.namespaceId.length > 0, 'scope.namespaceId is required')
}

function scopeKey(scope) {
  return `${scope.tenantId}::${scope.namespaceId}::${scope.agentId || ''}::${scope.sessionId || ''}`
}

function scopeBaseKey(scope) {
  return `${scope.tenantId}::${scope.namespaceId}`
}

function validateMemoryRef(ref) {
  assert(isObject(ref), 'memory ref must be an object')
  assert(typeof ref.id === 'string' && ref.id.length > 0, 'memory ref id is required')
  assert(typeof ref.type === 'string' && ref.type.length > 0, 'memory ref type is required')
  validateScope(ref.scope)
}

function buildRef(object) {
  return {
    id: object.id,
    type: object.type,
    scope: clone(object.scope)
  }
}

function validateStatus(status) {
  assert(durableStatuses.has(status), `invalid status: ${status}`)
}

module.exports = {
  assert,
  buildRef,
  clone,
  isObject,
  nowIso,
  scopeBaseKey,
  scopeKey,
  validateMemoryRef,
  validateScope,
  validateStatus
}
