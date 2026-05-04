import type { MemoryMonitor } from '../memory/monitor'
import type { BuildConfig, BuildContext, CjsConfig, EsmConfig, FormatOutputs, IifeConfig, UmdConfig } from '../models'
import type { PrePassJob } from './dependencies/pre-pass'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, join } from '@hyperfrontend/project-scope/core'
import { recover } from '../memory/recover'
import { runDtsPerEntry } from './declarations/dts-per-entry'
import { runDtsPrePass } from './declarations/dts-pre-pass'
import { generateDeclarations } from './declarations/generate-declarations'
import { resolveDefaultWorkerPath, runPrePass } from './dependencies/pre-pass'
import { resolveDepEntry } from './dependencies/resolve-dep-entry'
import { resolveEntries } from './entries/resolve-entries'
import { createCjsEntryConfig } from './rollup/config-cjs'
import { createEsmEntryConfig } from './rollup/config-esm'
import { createIifeEntryConfig } from './rollup/config-iife'
import { createUmdEntryConfig } from './rollup/config-umd'
import { executeRollup } from './rollup/execute'

const log = logger.channel('builder:bundle')

const toArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : isArray(value) ? value : [value])

const collectFormatsRequestingPrePass = (config: BuildConfig): Array<'esm' | 'cjs'> => {
  const formats = new Set<'esm' | 'cjs'>()
  for (const c of toArray<EsmConfig>(config.esm)) if (c.bundleAllDeps) formats.add('esm')
  for (const c of toArray<CjsConfig>(config.cjs)) if (c.bundleAllDeps) formats.add('cjs')
  return Array.from(formats)
}

const buildJsPrePassJobs = (deps: string[], formats: Array<'esm' | 'cjs'>, context: BuildContext): PrePassJob[] => {
  const jobs: PrePassJob[] = []
  const depsRoot = join(context.outputPath, '_dependencies')
  for (const dep of deps) {
    const entry = resolveDepEntry({ dep, projectRoot: context.projectRoot, workspaceRoot: context.workspaceRoot, kind: 'js' })
    for (const format of formats) {
      jobs.push({
        kind: 'js',
        dep,
        inputPath: entry,
        format,
        outputPath: join(depsRoot, dep, format === 'esm' ? 'index.esm.js' : 'index.cjs.js'),
        otherDeps: deps.filter((d) => d !== dep),
      })
    }
  }
  return jobs
}

const resolveWorkerInvocationOrThrow = (workspaceRoot: string): { path: string; execArgv: string[] } => {
  const invocation = resolveDefaultWorkerPath(workspaceRoot)
  if (!invocation) {
    throw createError(
      'bundleAllDeps is enabled but the pre-pass worker could not be resolved. Build @hyperfrontend/builder once with bundleAllDeps disabled, or ensure @swc-node/register is installed for source-mode bootstrap.'
    )
  }
  return invocation
}

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

  const requestedPrePassFormats = collectFormatsRequestingPrePass(config)
  if (context.bundledDeps.length > 0 && requestedPrePassFormats.length > 0) {
    const invocation = resolveWorkerInvocationOrThrow(context.workspaceRoot)
    const jobs = buildJsPrePassJobs(context.bundledDeps, requestedPrePassFormats, context)
    log.info(
      `bundle dependencies pre-pass: ${context.bundledDeps.length} deps × ${requestedPrePassFormats.length} formats = ${jobs.length} jobs`
    )
    monitor?.check('bundle:dependencies:prepass:start')
    await runPrePass(jobs, { workerPath: invocation.path, execArgv: invocation.execArgv, monitor })
    monitor?.check('bundle:dependencies:prepass:end')
  }

  for (const esmConfig of toArray(config.esm)) {
    const entries = resolveEntries(esmConfig, context.entryPointDiscovery.entryPoints)
    for (const [i, entry] of entries.entries()) {
      monitor?.check(`bundle:esm:${i}/${entries.length}:${entry.exportPath}:start`)
      await executeRollup(createEsmEntryConfig(entry, esmConfig, context), `esm:${entry.exportPath}`)
      monitor?.check(`bundle:esm:${i}/${entries.length}:${entry.exportPath}:end`)
      await recover()
    }
    outputs.esm.push(...entries)
  }

  await recover()
  monitor?.check('bundle:esm:end:post-recover')

  for (const cjsConfig of toArray(config.cjs)) {
    const entries = resolveEntries(cjsConfig, context.entryPointDiscovery.entryPoints)
    for (const [i, entry] of entries.entries()) {
      monitor?.check(`bundle:cjs:${i}/${entries.length}:${entry.exportPath}:start`)
      await executeRollup(createCjsEntryConfig(entry, cjsConfig, context), `cjs:${entry.exportPath}`)
      monitor?.check(`bundle:cjs:${i}/${entries.length}:${entry.exportPath}:end`)
      await recover()
    }
    outputs.cjs.push(...entries)
  }

  await recover()
  monitor?.check('bundle:cjs:end:post-recover')

  for (const iifeConfig of <IifeConfig[]>toArray(config.iife)) {
    const entries = resolveEntries(iifeConfig, context.entryPointDiscovery.entryPoints)
    if (entries.length > 0) {
      ensureDir(join(context.outputPath, iifeConfig.output ?? 'bundle'))
    }
    for (const [i, entry] of entries.entries()) {
      monitor?.check(`bundle:iife:${i}/${entries.length}:${entry.exportPath}:start`)
      await executeRollup(createIifeEntryConfig(entry, iifeConfig, context), `iife:${entry.exportPath}`)
      monitor?.check(`bundle:iife:${i}/${entries.length}:${entry.exportPath}:end`)
      await recover()
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
      await recover()
    }
    if (entries.length > 0) outputs.umd.push({ config: umdConfig, entries })
  }

  await recover()
  monitor?.check('bundle:declarations:start')
  await generateDeclarations(context)
  monitor?.check('bundle:declarations:end')

  if (context.bundledDeps.length > 0) {
    await runDtsPrePass(context, monitor)
    await runDtsPerEntry(context, monitor)
  }

  return outputs
}
