const { InMemoryEpisodeStore } = require('../storage/episode-store')
const { InMemoryGraphStore } = require('../storage/graph-store')
const { InMemoryIndexStore } = require('../storage/index-store')
const { InMemoryMetadataStore } = require('../storage/metadata-store')
const { EventStream } = require('../core/events')
const { MemoryService } = require('../api/memory-service')

function createInMemoryRuntime() {
  const episodeStore = new InMemoryEpisodeStore()
  const graphStore = new InMemoryGraphStore()
  const indexStore = new InMemoryIndexStore()
  const metadataStore = new InMemoryMetadataStore()
  const eventStream = new EventStream()

  return new MemoryService({
    episodeStore,
    graphStore,
    indexStore,
    metadataStore,
    eventStream
  })
}

module.exports = {
  createInMemoryRuntime
}
