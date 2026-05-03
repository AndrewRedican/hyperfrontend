import type { MemoryMonitor } from '../memory/monitor'
import type { BuildConfig, BuildContext, FormatOutputs, IifeConfig, UmdConfig } from '../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { ensureDir, join } from '@hyperfrontend/project-scope/core'
import { generateDeclarations } from './declarations/generate-declarations'
import { resolveEntries } from './entries/resolve-entries'
import { createCjsEntryConfig } from './rollup/config-cjs'
import { createEsmEntryConfig } from './rollup/config-esm'
import { createIifeEntryConfig } from './rollup/config-iife'
import { createUmdEntryConfig } from './rollup/config-umd'
import { executeRollup } from './rollup/execute'

const toArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : isArray(value) ? value : [value])

/**
 * Runs the entire bundle phase: ESM, CJS, IIFE, UMD outputs followed by declaration emission.
 *
 * Iterates the format-specific configurations in `config`, resolves the matching
 * entry points via `resolveEntries`, and feeds each one through `executeRollup`
 * with the appropriate per-format configuration factory. After every bundle has
 * been written, calls `generateDeclarations` exactly once to emit `.d.ts` files
 * for the project.
 *
 * @param context - Resolved build context.
 * @param config - Top-level builder configuration. Only the format and `tsConfig`
 * fields are consulted by this phase.
 * @param monitor - Optional memory monitor; when provided, `check()` is invoked
 * before and after every rollup invocation and the declarations phase so peak
 * heap inside the bundle phase is observable rather than silent.
 * @returns Aggregated outputs grouped by format.
 *
 * @example Driving the bundle phase from a custom orchestrator
 * ```typescript
 * const formatOutputs = await runBundlePhase(context, config)
 * ```
 */
export const runBundlePhase = async (context: BuildContext, config: BuildConfig, monitor?: MemoryMonitor): Promise<FormatOutputs> => {
  const outputs: FormatOutputs = { esm: [], cjs: [], iife: [], umd: [] }

  for (const esmConfig of toArray(config.esm)) {
    const entries = resolveEntries(esmConfig, context.entryPointDiscovery.entryPoints)
    for (const [i, entry] of entries.entries()) {
      monitor?.check(`bundle:esm:${i}/${entries.length}:${entry.exportPath}:start`)
      await executeRollup(createEsmEntryConfig(entry, esmConfig, context), `esm:${entry.exportPath}`)
      monitor?.check(`bundle:esm:${i}/${entries.length}:${entry.exportPath}:end`)
    }
    outputs.esm.push(...entries)
  }

  for (const cjsConfig of toArray(config.cjs)) {
    const entries = resolveEntries(cjsConfig, context.entryPointDiscovery.entryPoints)
    for (const [i, entry] of entries.entries()) {
      monitor?.check(`bundle:cjs:${i}/${entries.length}:${entry.exportPath}:start`)
      await executeRollup(createCjsEntryConfig(entry, cjsConfig, context), `cjs:${entry.exportPath}`)
      monitor?.check(`bundle:cjs:${i}/${entries.length}:${entry.exportPath}:end`)
    }
    outputs.cjs.push(...entries)
  }

  for (const iifeConfig of <IifeConfig[]>toArray(config.iife)) {
    const entries = resolveEntries(iifeConfig, context.entryPointDiscovery.entryPoints)
    if (entries.length > 0) {
      ensureDir(join(context.outputPath, iifeConfig.output ?? 'bundle'))
    }
    for (const [i, entry] of entries.entries()) {
      monitor?.check(`bundle:iife:${i}/${entries.length}:${entry.exportPath}:start`)
      await executeRollup(createIifeEntryConfig(entry, iifeConfig, context), `iife:${entry.exportPath}`)
      monitor?.check(`bundle:iife:${i}/${entries.length}:${entry.exportPath}:end`)
    }
    if (entries.length > 0) outputs.iife.push({ config: iifeConfig, entries })
  }

  for (const umdConfig of <UmdConfig[]>toArray(config.umd)) {
    const entries = resolveEntries(umdConfig, context.entryPointDiscovery.entryPoints)
    if (entries.length > 0) {
      ensureDir(join(context.outputPath, umdConfig.output ?? 'bundle'))
    }
    for (const [i, entry] of entries.entries()) {
      monitor?.check(`bundle:umd:${i}/${entries.length}:${entry.exportPath}:start`)
      await executeRollup(createUmdEntryConfig(entry, umdConfig, context), `umd:${entry.exportPath}`)
      monitor?.check(`bundle:umd:${i}/${entries.length}:${entry.exportPath}:end`)
    }
    if (entries.length > 0) outputs.umd.push({ config: umdConfig, entries })
  }

  monitor?.check('bundle:declarations:start')
  await generateDeclarations(context)
  monitor?.check('bundle:declarations:end')
  return outputs
}
