import type { RollupOptions } from 'rollup'
import { rollup } from 'rollup'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger } from '@hyperfrontend/logging'

const log = logger.channel('builder:bundle:rollup')

/**
 * Executes a single Rollup configuration: creates the bundle, writes every output,
 * closes it, and clears references to encourage prompt garbage collection.
 *
 * Designed for sequential per-entry rollup invocations where keeping memory low
 * matters more than maximum throughput.
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
