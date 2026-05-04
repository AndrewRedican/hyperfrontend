import type { RollupOptions } from 'rollup'
import { freemem } from 'node:os'
import { rollup } from 'rollup'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger } from '@hyperfrontend/logging'

const log = logger.channel('builder:bundle:rollup')

const BYTES_PER_MB = 1024 * 1024
const formatMB = (bytes: number): string => (bytes / BYTES_PER_MB).toFixed(1)

/**
 * Executes a single Rollup configuration: creates the bundle, writes every output,
 * closes it, and clears references to encourage prompt garbage collection.
 *
 * Designed for sequential per-entry rollup invocations where keeping memory low
 * matters more than maximum throughput. Logs an `info` line with parent heap,
 * RSS, and OS free memory before invoking `rollup()` so an external SIGKILL
 * (kernel OOM during the transform phase) leaves a forensic snapshot of the
 * memory state at the moment of the kill.
 *
 * @param config - Rollup configuration. The function mutates this object after writing
 * outputs to clear references — callers should treat it as consumed.
 * @param label - Human-readable label used in debug log lines.
 * @returns Promise that resolves once every output is written.
 *
 * @example Running a single rollup pass
 * ```typescript
 * await executeRollup(createEsmEntryConfig(entry, esmConfig, context), entry.exportPath)
 * ```
 */
export const executeRollup = async (config: RollupOptions, label: string): Promise<void> => {
  const usage = process.memoryUsage()
  log.info(`pre-rollup ${label}: heap=${formatMB(usage.heapUsed)}MB rss=${formatMB(usage.rss)}MB free=${formatMB(freemem())}MB`)
  log.debug(`starting rollup for ${label}`)
  const bundle = await rollup(config)
  try {
    const outputs = isArray(config.output) ? config.output : config.output ? [config.output] : []
    for (const output of outputs) {
      log.debug(`writing output for ${label}`)
      await bundle.write(output)
    }
  } finally {
    await bundle.close()
  }

  for (const key of <(keyof RollupOptions)[]>keys(config)) {
    ;(<Record<string, unknown>>config)[key] = undefined
  }
}
