import type { MemoryMonitor } from '../memory/monitor'
import type { BuildConfig, BuildContext, CjsConfig, EsmConfig, FormatOutputs, IifeConfig, UmdConfig, WorkspaceBundledDep } from '../models'
import type { PrePassJob } from './dependencies/pre-pass'
import type { RollupBuildDescriptor } from './rollup/worker/types'
import { from, isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, exists, join } from '@hyperfrontend/project-scope/core'
import { recover } from '../memory/recover'
import { runDtsPerEntry } from './declarations/dts-per-entry'
import { runDtsPrePass } from './declarations/dts-pre-pass'
import { generateDeclarations } from './declarations/generate-declarations'
import { pruneOrphanDeclarations } from './declarations/prune-orphan-dts'
import { verifyEntryTypeRefs } from './declarations/verify-entry-refs'
import { chunkFileName } from './dedupe/attribute-modules'
import { hoistSharedFirstParty } from './dedupe/hoist-shared'
import { collectWorkspaceExactSpecifiers, collectWorkspacePrefixDeps } from './dependencies/collect-workspace-deps'
import { buildWorkspaceRoutes } from './dependencies/externalize-plugin'
import { resolveDefaultWorkerPath, runPrePass } from './dependencies/pre-pass'
import { pruneDependencies } from './dependencies/prune/prune-dependencies'
import { resolveDepEntry } from './dependencies/resolve-dep-entry'
import { resolveEntries } from './entries/resolve-entries'
import { depsRootOf } from './fs/deps-root'
import { removeEmptyDirs } from './fs/empty-dirs'
import { toCjsBuildDescriptor, toEsmBuildDescriptor, toIifeBuildDescriptor, toUmdBuildDescriptor } from './rollup/descriptor'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from './rollup/dispatch'
import { stripBundleCommentsPass } from './strip-bundle-comments'

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

const toArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : isArray(value) ? <T[]>value : [<T>value])

const collectFormatsRequestingPrePass = (config: BuildConfig): Array<'esm' | 'cjs'> => {
  const formats = createSet<'esm' | 'cjs'>([])
  for (const c of toArray<EsmConfig>(config.esm)) if (c.bundleAllDeps) formats.add('esm')
  for (const c of toArray<CjsConfig>(config.cjs)) if (c.bundleAllDeps) formats.add('cjs')
  return from(formats)
}

const buildJsPrePassJobs = (deps: string[], formats: Array<'esm' | 'cjs'>, context: BuildContext): PrePassJob[] => {
  const jobs: PrePassJob[] = []
  const depsRoot = depsRootOf(context)
  const workspacePrefixDeps = collectWorkspacePrefixDeps(context)
  const workspaceExactSpecifiers = collectWorkspaceExactSpecifiers(context)
  const workspaceRoutes = buildWorkspaceRoutes(context.workspaceBundledDeps)
  for (const dep of deps) {
    const entry = resolveDepEntry({ dep, projectRoot: context.projectRoot, workspaceRoot: context.workspaceRoot, kind: 'js' })
    const otherNpmDeps = deps.filter((d) => d !== dep)
    for (const format of formats) {
      jobs.push({
        kind: 'js',
        dep,
        inputPath: entry,
        format,
        outputPath: join(depsRoot, dep, chunkFileName(format)),
        otherDeps: [...otherNpmDeps, ...workspacePrefixDeps],
        otherWorkspaceSpecifiers: workspaceExactSpecifiers,
        npmDeps: otherNpmDeps,
        workspaceRoutes,
        depsRoot,
      })
    }
  }
  return jobs
}

const workspaceOutputFile = (entry: BuildContext['workspaceBundledDeps'][number], format: 'esm' | 'cjs'): string => {
  const fileName = chunkFileName(format)
  return entry.subPath ? `${entry.specifier}/${fileName}` : `${entry.packageName}/${fileName}`
}

const filterRouteEntries = (entry: WorkspaceBundledDep, all: WorkspaceBundledDep[]): WorkspaceBundledDep[] =>
  all.filter((other) => (entry.policy === 'sub-path' ? other.specifier !== entry.specifier : other.packageName !== entry.packageName))

const buildWorkspaceJsPrePassJobs = (npmDeps: string[], formats: Array<'esm' | 'cjs'>, context: BuildContext): PrePassJob[] => {
  if (context.workspaceBundledDeps.length === 0) return []
  const jobs: PrePassJob[] = []
  const depsRoot = depsRootOf(context)
  const wholeSurface = collectWorkspacePrefixDeps(context)
  const subPathSpecifiers = collectWorkspaceExactSpecifiers(context)
  for (const entry of context.workspaceBundledDeps) {
    const otherWorkspacePackages = wholeSurface.filter((name) => name !== entry.packageName || entry.policy === 'sub-path')
    const otherSubPathSpecifiers = subPathSpecifiers.filter((spec) => spec !== entry.specifier)
    const workspaceRoutes = buildWorkspaceRoutes(filterRouteEntries(entry, context.workspaceBundledDeps))
    for (const format of formats) {
      jobs.push({
        kind: 'workspace-js',
        dep: entry.specifier,
        inputPath: entry.inputPath,
        format,
        outputPath: join(depsRoot, workspaceOutputFile(entry, format)),
        otherDeps: [...npmDeps, ...otherWorkspacePackages],
        otherWorkspaceSpecifiers: otherSubPathSpecifiers,
        tsConfigPath: entry.tsConfigPath,
        workspaceRoot: context.workspaceRoot,
        npmDeps,
        workspaceRoutes,
        depsRoot,
      })
    }
  }
  return jobs
}

const resolvePrePassWorkerOrThrow = (): ResolvedWorkerInvocation => {
  const invocation = resolveDefaultWorkerPath()
  if (!invocation) {
    throw createError(
      'bundleAllDeps is enabled but the pre-pass worker could not be located beside the builder module. The @hyperfrontend/builder package appears incomplete, or @swc-node/register is missing for source-mode bootstrap.'
    )
  }
  return invocation
}

const resolveRollupWorkerOrThrow = (): ResolvedWorkerInvocation => {
  const invocation = resolveDefaultRollupWorkerPath()
  if (!invocation) {
    throw createError(
      'rollup worker could not be located beside the builder module. The @hyperfrontend/builder package appears incomplete, or @swc-node/register is missing for source-mode bootstrap.'
    )
  }
  return invocation
}

const createLazyDispatchResolver = (): ResolveDispatch => {
  let cached: DispatchOptions | null = null
  return () => {
    if (!cached) {
      const invocation = resolveRollupWorkerOrThrow()
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
 * entry points for each format, and bundles every one. After all bundles are
 * written, emits `.d.ts` declarations for the project exactly once.
 *
 * @param context - Resolved build context.
 * @param config - Top-level builder configuration. Only the format and `tsConfig`
 * fields are consulted by this phase.
 * @param monitor - Optional memory monitor; when provided, peak heap inside the
 * bundle phase is sampled at each format and declaration step.
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
  if (requestedPrePassFormats.length > 0 && (context.bundledDeps.length > 0 || context.workspaceBundledDeps.length > 0)) {
    const invocation = resolvePrePassWorkerOrThrow()
    const npmJobs = buildJsPrePassJobs(context.bundledDeps, requestedPrePassFormats, context)
    const workspaceJobs = buildWorkspaceJsPrePassJobs(context.bundledDeps, requestedPrePassFormats, context)
    const jobs = [...npmJobs, ...workspaceJobs]
    log.info(
      `bundle dependencies pre-pass: ${context.bundledDeps.length} npm + ${context.workspaceBundledDeps.length} workspace × ${requestedPrePassFormats.length} formats = ${jobs.length} jobs`
    )
    monitor?.check('bundle:dependencies:prepass:start')
    await runPrePass(jobs, { workerPath: invocation.path, execArgv: invocation.execArgv, monitor })
    monitor?.check('bundle:dependencies:prepass:end')
  }

  const resolveDispatch = createLazyDispatchResolver()

  await runEsmFormats(config, context, outputs, resolveDispatch, monitor)
  await recover()
  monitor?.check('bundle:esm:end:post-recover')

  await runCjsFormats(config, context, outputs, resolveDispatch, monitor)
  await recover()
  monitor?.check('bundle:cjs:end:post-recover')

  await runIifeFormats(config, context, outputs, resolveDispatch, monitor)
  await runUmdFormats(config, context, outputs, resolveDispatch, monitor)

  // why: the non-minified iife/umd files keep source comments verbatim (only the .min twins pass through terser); strip internal pragmas/JSDoc post-emit so published bundles carry no tooling residue.
  stripBundleCommentsPass(context.outputPath, outputs)
  monitor?.check('bundle:strip-comments:end')

  await recover()
  monitor?.check('bundle:declarations:start')
  await generateDeclarations(context)
  monitor?.check('bundle:declarations:end')

  if (context.bundledDeps.length > 0 || context.workspaceBundledDeps.length > 0) {
    await runDtsPrePass(context, monitor)
    await runDtsPerEntry(context, monitor)
  }

  pruneOrphanDeclarations(context)
  monitor?.check('bundle:declarations:prune-orphans:end')

  // why: the entry declarations are final here, so a reference a sibling entry never exported is caught before the package can publish a type surface that degrades to `any` behind consumers' `skipLibCheck`.
  verifyEntryTypeRefs(context)
  monitor?.check('bundle:declarations:verify-entry-refs:end')

  if (context.bundledDeps.length > 0 || context.workspaceBundledDeps.length > 0) {
    pruneDependencies(context, monitor)
    monitor?.check('bundle:dependencies:prune:end')
  }

  // why: dedup runs after prune so the lifted `_shared/` files are still present when `finalizeFilesAllowlist` reflects the published output tree.
  if (config.dedupeSharedInternals !== false) {
    hoistSharedFirstParty(context, monitor)
    monitor?.check('bundle:dedupe:shared-first-party:end')
  }

  // why: runs last (after the final file-producing pass) so no later pass re-creates a file under a removed directory; sweeps the per-source dirs left empty by the orphan-d.ts prune across the whole package, not just `_dependencies/`. Guarded for the degenerate case where no format produced an output tree.
  if (exists(context.outputPath)) {
    const emptyDirsRemoved = removeEmptyDirs(context.outputPath)
    if (emptyDirsRemoved > 0) log.info(`removed ${emptyDirsRemoved} empty director${emptyDirsRemoved === 1 ? 'y' : 'ies'}`)
  }
  monitor?.check('bundle:empty-dirs:end')

  return outputs
}
