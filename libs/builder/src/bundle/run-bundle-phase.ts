import type { MemoryMonitor } from '../memory/monitor'
import type { BuildConfig, BuildContext, CjsConfig, EsmConfig, FormatOutputs, IifeConfig, UmdConfig } from '../models'
import type { PrePassJob } from './dependencies/pre-pass'
import type { RollupBuildDescriptor } from './rollup/worker/types'
import { from, isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, join } from '@hyperfrontend/project-scope/core'
import { recover } from '../memory/recover'
import { runDtsPerEntry } from './declarations/dts-per-entry'
import { runDtsPrePass } from './declarations/dts-pre-pass'
import { generateDeclarations } from './declarations/generate-declarations'
import { resolveDefaultWorkerPath, runPrePass } from './dependencies/pre-pass'
import { resolveDepEntry } from './dependencies/resolve-dep-entry'
import { resolveEntries } from './entries/resolve-entries'
import { toCjsBuildDescriptor, toEsmBuildDescriptor, toIifeBuildDescriptor, toUmdBuildDescriptor } from './rollup/descriptor'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './rollup/dispatch'

const log = logger.channel('builder:bundle')

/**
 * Resolved worker invocation: absolute path + any extra Node argv prepended to the spawned child.
 */
interface ResolvedWorkerInvocation {
  /** Absolute path to the worker entry script. */
  path: string
  /** Extra args prepended to the spawned child's argv (e.g., `['--require', '@swc-node/register']`). */
  execArgv: string[]
}

/**
 * Cached rollup-worker dispatch options resolved on-demand the first time a
 * format actually needs to spawn a worker.
 */
interface DispatchOptions {
  /** Absolute path to the rollup worker entry script. */
  workerPath: string
  /** Extra args prepended to the spawned child's argv. */
  execArgv: string[]
}

/**
 * Lazy resolver that materializes the dispatch options on first call and
 * caches them for every subsequent call.
 */
type ResolveDispatch = () => DispatchOptions

const toArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : isArray(value) ? value : [value])

const collectFormatsRequestingPrePass = (config: BuildConfig): Array<'esm' | 'cjs'> => {
  const formats = createSet<'esm' | 'cjs'>([])
  for (const c of toArray<EsmConfig>(config.esm)) if (c.bundleAllDeps) formats.add('esm')
  for (const c of toArray<CjsConfig>(config.cjs)) if (c.bundleAllDeps) formats.add('cjs')
  return from(formats)
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

const resolvePrePassWorkerOrThrow = (workspaceRoot: string): ResolvedWorkerInvocation => {
  const invocation = resolveDefaultWorkerPath(workspaceRoot)
  if (!invocation) {
    throw createError(
      'bundleAllDeps is enabled but the pre-pass worker could not be resolved. Build @hyperfrontend/builder once with bundleAllDeps disabled, or ensure @swc-node/register is installed for source-mode bootstrap.'
    )
  }
  return invocation
}

const resolveRollupWorkerOrThrow = (workspaceRoot: string): ResolvedWorkerInvocation => {
  const invocation = resolveDefaultRollupWorkerPath(workspaceRoot)
  if (!invocation) {
    throw createError(
      'rollup worker could not be resolved. Build @hyperfrontend/builder at least once before invoking the bundle phase, or ensure @swc-node/register is installed for source-mode bootstrap.'
    )
  }
  return invocation
}

const createLazyDispatchResolver = (workspaceRoot: string): ResolveDispatch => {
  let cached: DispatchOptions | null = null
  return () => {
    if (!cached) {
      const invocation = resolveRollupWorkerOrThrow(workspaceRoot)
      cached = { workerPath: invocation.path, execArgv: invocation.execArgv }
    }
    return cached
  }
}

const dispatch = async (descriptor: RollupBuildDescriptor, label: string, options: DispatchOptions): Promise<void> => {
  await dispatchRollupWorker(descriptor, {
    workerPath: options.workerPath,
    execArgv: options.execArgv,
    label,
  })
}

const runEsmFormats = async (
  config: BuildConfig,
  context: BuildContext,
  outputs: FormatOutputs,
  resolveDispatch: ResolveDispatch,
  monitor?: MemoryMonitor
): Promise<void> => {
  for (const esmConfig of toArray<EsmConfig>(config.esm)) {
    const entries = resolveEntries(esmConfig, context.entryPointDiscovery.entryPoints)
    for (const [i, entry] of entries.entries()) {
      const label = `esm:${i}/${entries.length}:${entry.exportPath}`
      monitor?.check(`bundle:${label}:start`)
      const descriptor = toEsmBuildDescriptor(entry, esmConfig, context, '')
      await dispatch(descriptor, label, resolveDispatch())
      monitor?.check(`bundle:${label}:end`)
    }
    outputs.esm.push(...entries)
  }
}

const runCjsFormats = async (
  config: BuildConfig,
  context: BuildContext,
  outputs: FormatOutputs,
  resolveDispatch: ResolveDispatch,
  monitor?: MemoryMonitor
): Promise<void> => {
  for (const cjsConfig of toArray<CjsConfig>(config.cjs)) {
    const entries = resolveEntries(cjsConfig, context.entryPointDiscovery.entryPoints)
    for (const [i, entry] of entries.entries()) {
      const label = `cjs:${i}/${entries.length}:${entry.exportPath}`
      monitor?.check(`bundle:${label}:start`)
      const descriptor = toCjsBuildDescriptor(entry, cjsConfig, context, '')
      await dispatch(descriptor, label, resolveDispatch())
      monitor?.check(`bundle:${label}:end`)
    }
    outputs.cjs.push(...entries)
  }
}

const runIifeFormats = async (
  config: BuildConfig,
  context: BuildContext,
  outputs: FormatOutputs,
  resolveDispatch: ResolveDispatch,
  monitor?: MemoryMonitor
): Promise<void> => {
  for (const iifeConfig of <IifeConfig[]>toArray(config.iife)) {
    const entries = resolveEntries(iifeConfig, context.entryPointDiscovery.entryPoints)
    if (entries.length === 0) continue
    ensureDir(join(context.outputPath, iifeConfig.output ?? 'bundle'))
    for (const [i, entry] of entries.entries()) {
      const label = `iife:${i}/${entries.length}:${entry.exportPath}`
      monitor?.check(`bundle:${label}:start`)
      const descriptor = toIifeBuildDescriptor(entry, iifeConfig, context, '')
      await dispatch(descriptor, label, resolveDispatch())
      monitor?.check(`bundle:${label}:end`)
    }
    outputs.iife.push({ config: iifeConfig, entries })
  }
}

const runUmdFormats = async (
  config: BuildConfig,
  context: BuildContext,
  outputs: FormatOutputs,
  resolveDispatch: ResolveDispatch,
  monitor?: MemoryMonitor
): Promise<void> => {
  for (const umdConfig of <UmdConfig[]>toArray(config.umd)) {
    const entries = resolveEntries(umdConfig, context.entryPointDiscovery.entryPoints)
    if (entries.length === 0) continue
    ensureDir(join(context.outputPath, umdConfig.output ?? 'bundle'))
    for (const [i, entry] of entries.entries()) {
      const label = `umd:${i}/${entries.length}:${entry.exportPath}`
      monitor?.check(`bundle:${label}:start`)
      const descriptor = toUmdBuildDescriptor(entry, umdConfig, context, '')
      await dispatch(descriptor, label, resolveDispatch())
      monitor?.check(`bundle:${label}:end`)
    }
    outputs.umd.push({ config: umdConfig, entries })
  }
}

/**
 * Runs the entire bundle phase: ESM, CJS, IIFE, UMD outputs followed by declaration emission.
 *
 * Iterates the format-specific configurations in `config`, resolves the matching
 * entry points via `resolveEntries`, and feeds each one through a forked rollup
 * worker. Workerization is mandatory: V8 retains freed pages even after explicit
 * GC, so an in-process loop walks parent RSS up to the kernel SIGKILL ceiling on
 * non-trivial libraries (per-entry rollup invocations accumulate ~150-225MB heap
 * each). After every bundle has been written, calls `generateDeclarations`
 * exactly once to emit `.d.ts` files for the project.
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
    const invocation = resolvePrePassWorkerOrThrow(context.workspaceRoot)
    const jobs = buildJsPrePassJobs(context.bundledDeps, requestedPrePassFormats, context)
    log.info(
      `bundle dependencies pre-pass: ${context.bundledDeps.length} deps × ${requestedPrePassFormats.length} formats = ${jobs.length} jobs`
    )
    monitor?.check('bundle:dependencies:prepass:start')
    await runPrePass(jobs, { workerPath: invocation.path, execArgv: invocation.execArgv, monitor })
    monitor?.check('bundle:dependencies:prepass:end')
  }

  const resolveDispatch = createLazyDispatchResolver(context.workspaceRoot)

  await runEsmFormats(config, context, outputs, resolveDispatch, monitor)
  await recover()
  monitor?.check('bundle:esm:end:post-recover')

  await runCjsFormats(config, context, outputs, resolveDispatch, monitor)
  await recover()
  monitor?.check('bundle:cjs:end:post-recover')

  await runIifeFormats(config, context, outputs, resolveDispatch, monitor)
  await runUmdFormats(config, context, outputs, resolveDispatch, monitor)

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
