import type { MemoryMonitorOptions } from '../models'
import { freemem, totalmem } from 'node:os'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger } from '@hyperfrontend/logging'

const DEFAULT_WARNING_MB = 512
const DEFAULT_CRITICAL_MB = 768
const DEFAULT_GROWTH_MB = 50
const BYTES_PER_MB = 1024 * 1024

/**
 * Single memory measurement captured by the monitor.
 *
 * Sizes are normalized to megabytes (1 MB = 1024 * 1024 bytes) so callers can
 * compare directly against the configured thresholds.
 */
export interface MemorySnapshot {
  /** Caller-supplied label identifying the capture site. */
  label: string
  /** Wall-clock timestamp (ms since epoch) when the snapshot was taken. */
  timestampMs: number
  /** `process.memoryUsage().heapUsed` in MB. */
  heapUsedMB: number
  /** `process.memoryUsage().heapTotal` in MB. */
  heapTotalMB: number
  /** `process.memoryUsage().rss` in MB. */
  rssMB: number
  /** `process.memoryUsage().external` in MB. */
  externalMB: number
}

/**
 * Monitor instance returned by `createMemoryMonitor`.
 */
export interface MemoryMonitor {
  /** Capture a snapshot, append it to the history, and return it. */
  snapshot: (label: string) => MemorySnapshot
  /** Capture a snapshot and emit warnings when configured thresholds are crossed. */
  check: (label: string) => MemorySnapshot
  /** Capture a snapshot and emit a debug-level log line summarizing it. */
  logDebug: (label: string) => MemorySnapshot
  /** Emit an info-level summary covering every snapshot taken so far. */
  logSummary: () => void
  /** Returns a copy of every snapshot captured so far. */
  getSnapshots: () => MemorySnapshot[]
}

const toMB = (bytes: number): number => bytes / BYTES_PER_MB

const formatMB = (mb: number): string => mb.toFixed(1)

/**
 * Creates an opt-in memory monitor backed by `process.memoryUsage()`.
 *
 * The monitor records snapshot history, emits threshold warnings when
 * `check()` is called, and is intended for instrumenting long-running build
 * phases. All thresholds default to safe values when omitted.
 *
 * @param options - Optional threshold overrides. Each field defaults to a value
 * appropriate for builder workloads (warning 512 MB, critical 768 MB, growth 50 MB).
 * @returns A frozen `MemoryMonitor` with snapshot, check, logDebug, logSummary,
 * and getSnapshots methods.
 *
 * @example Recording snapshots between phases
 * ```typescript
 * const monitor = createMemoryMonitor({ warningMB: 256, criticalMB: 512, growthMB: 32 })
 * monitor.check('bundle:start')
 * await runBundlePhase(ctx, config)
 * monitor.check('bundle:end')
 * monitor.logSummary()
 * ```
 */
export const createMemoryMonitor = (options: MemoryMonitorOptions = {}): MemoryMonitor => {
  const warningMB = options.warningMB ?? DEFAULT_WARNING_MB
  const criticalMB = options.criticalMB ?? DEFAULT_CRITICAL_MB
  const growthMB = options.growthMB ?? DEFAULT_GROWTH_MB
  const log = logger.channel('memory')
  const history: MemorySnapshot[] = []

  const capture = (label: string): MemorySnapshot => {
    const usage = process.memoryUsage()
    const snapshot: MemorySnapshot = freeze({
      label,
      timestampMs: dateNow(),
      heapUsedMB: toMB(usage.heapUsed),
      heapTotalMB: toMB(usage.heapTotal),
      rssMB: toMB(usage.rss),
      externalMB: toMB(usage.external),
    })
    history.push(snapshot)
    return snapshot
  }

  const systemSuffix = (current: MemorySnapshot): string =>
    `rss=${formatMB(current.rssMB)}MB free=${formatMB(toMB(freemem()))}MB total=${formatMB(toMB(totalmem()))}MB`

  const evaluateThresholds = (current: MemorySnapshot): void => {
    if (current.heapUsedMB >= criticalMB) {
      log.error(
        `${current.label}: critical heap usage ${formatMB(current.heapUsedMB)}MB >= threshold ${criticalMB}MB ${systemSuffix(current)}`
      )
    } else if (current.heapUsedMB >= warningMB) {
      log.warn(`${current.label}: high heap usage ${formatMB(current.heapUsedMB)}MB >= threshold ${warningMB}MB ${systemSuffix(current)}`)
    }
    const previous = history[history.length - 2]
    if (previous && current.heapUsedMB - previous.heapUsedMB >= growthMB) {
      log.warn(
        `${current.label}: heap grew ${formatMB(current.heapUsedMB - previous.heapUsedMB)}MB since '${previous.label}' (threshold ${growthMB}MB) ${systemSuffix(current)}`
      )
    }
  }

  const monitor: MemoryMonitor = freeze({
    snapshot: capture,
    check: (label: string): MemorySnapshot => {
      const snap = capture(label)
      evaluateThresholds(snap)
      return snap
    },
    logDebug: (label: string): MemorySnapshot => {
      const snap = capture(label)
      log.debug(`${label}: heap=${formatMB(snap.heapUsedMB)}MB rss=${formatMB(snap.rssMB)}MB`)
      return snap
    },
    logSummary: (): void => {
      if (history.length === 0) {
        log.info('no snapshots captured')
        return
      }
      const peakHeap = history.reduce((peak, snap) => max(peak, snap.heapUsedMB), 0)
      const peakRss = history.reduce((peak, snap) => max(peak, snap.rssMB), 0)
      const first = history[0] as MemorySnapshot
      const last = history[history.length - 1] as MemorySnapshot
      const elapsed = last.timestampMs - first.timestampMs
      log.info(`peak heap=${formatMB(peakHeap)}MB peak rss=${formatMB(peakRss)}MB across ${history.length} snapshots over ${elapsed}ms`)
    },
    getSnapshots: (): MemorySnapshot[] => history.slice(),
  })
  return monitor
}
