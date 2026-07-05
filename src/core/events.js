class EventStream {
  constructor() {
    this.cursor = 0
    this.events = []
  }

  publish(event) {
    this.cursor += 1
    const cursor = `cursor_${String(this.cursor).padStart(8, '0')}`
    const payload = {
      ...event,
      cursor,
      occurredAt: event.occurredAt || new Date().toISOString()
    }
    this.events.push(payload)
    return payload
  }

  listSince(scope, cursor = null, eventTypes = null) {
    const startIndex = cursor
      ? this.events.findIndex((entry) => entry.cursor === cursor) + 1
      : 0

    return this.events
      .slice(Math.max(0, startIndex))
      .filter((entry) => {
        if (scope && (entry.scope?.tenantId !== scope.tenantId || entry.scope?.namespaceId !== scope.namespaceId)) {
          return false
        }

        if (Array.isArray(eventTypes) && eventTypes.length > 0) {
          return eventTypes.includes(entry.eventType)
        }

        return true
      })
  }
}

module.exports = {
  EventStream
}
