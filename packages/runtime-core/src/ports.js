export class EpisodeStore {
  async appendEpisode(_episode) {
    throw new Error("EpisodeStore.appendEpisode must be implemented")
  }

  async getEpisodeByRef(_ref) {
    throw new Error("EpisodeStore.getEpisodeByRef must be implemented")
  }

  async getEpisodesByRefs(_refs) {
    throw new Error("EpisodeStore.getEpisodesByRefs must be implemented")
  }

  async resolveDedupeKey(_scope, _dedupeKey) {
    throw new Error("EpisodeStore.resolveDedupeKey must be implemented")
  }

  async tombstoneEpisode(_ref, _reason) {
    throw new Error("EpisodeStore.tombstoneEpisode must be implemented")
  }
}

export class GraphStore {
  async addLink(_link) {
    throw new Error("GraphStore.addLink must be implemented")
  }

  async getOutgoingLinks(_ref) {
    throw new Error("GraphStore.getOutgoingLinks must be implemented")
  }

  async getIncomingLinks(_ref) {
    throw new Error("GraphStore.getIncomingLinks must be implemented")
  }

  async getProvenanceChain(_ref) {
    throw new Error("GraphStore.getProvenanceChain must be implemented")
  }

  async tombstoneLink(_ref) {
    throw new Error("GraphStore.tombstoneLink must be implemented")
  }
}

export class IndexStore {
  async indexMemoryPayload(_payload) {
    throw new Error("IndexStore.indexMemoryPayload must be implemented")
  }

  async removeOrHidePayload(_ref) {
    throw new Error("IndexStore.removeOrHidePayload must be implemented")
  }

  async searchByQueryPayload(_scope, _query, _filters, _limit) {
    throw new Error("IndexStore.searchByQueryPayload must be implemented")
  }

  async searchByFilters(_scope, _filters, _limit) {
    throw new Error("IndexStore.searchByFilters must be implemented")
  }

  async getIndexFreshness(_scope) {
    throw new Error("IndexStore.getIndexFreshness must be implemented")
  }
}

export class MetadataStore {
  async upsertScope(_scope) {
    throw new Error("MetadataStore.upsertScope must be implemented")
  }

  async saveJob(_job) {
    throw new Error("MetadataStore.saveJob must be implemented")
  }

  async getJob(_scope, _jobId) {
    throw new Error("MetadataStore.getJob must be implemented")
  }

  async savePluginState(_pluginName, _state) {
    throw new Error("MetadataStore.savePluginState must be implemented")
  }

  async saveEventCursor(_scope, _cursor) {
    throw new Error("MetadataStore.saveEventCursor must be implemented")
  }

  async appendEvent(_scope, _event) {
    throw new Error("MetadataStore.appendEvent must be implemented")
  }

  async getEventsSince(_scope, _cursor, _eventTypes) {
    throw new Error("MetadataStore.getEventsSince must be implemented")
  }
}
