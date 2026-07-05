export type RuntimeMetrics = {
  ingestTotal: number
  queryTotal: number
  tombstoneTotal: number
  jobsCompleted: number
  jobsFailed: number
}

export type RuntimeMetricsHook = {
  onIngest?: (episodeCount: number) => void
  onQuery?: () => void
  onTombstone?: (refCount: number) => void
  onJobCompleted?: () => void
  onJobFailed?: () => void
}

export const createRuntimeMetrics = (): RuntimeMetrics => ({
  ingestTotal: 0,
  queryTotal: 0,
  tombstoneTotal: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
})

export const metricsHookFromCounters = (metrics: RuntimeMetrics): RuntimeMetricsHook => ({
  onIngest: (episodeCount) => {
    metrics.ingestTotal += episodeCount
  },
  onQuery: () => {
    metrics.queryTotal += 1
  },
  onTombstone: (refCount) => {
    metrics.tombstoneTotal += refCount
  },
  onJobCompleted: () => {
    metrics.jobsCompleted += 1
  },
  onJobFailed: () => {
    metrics.jobsFailed += 1
  },
})
