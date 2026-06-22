import type { MemoryMonitor } from './memory/monitor'
import type {
  BuildConfig,
  BuildContext,
  BuildResult,
  BundleAllDepsOptions,
  CjsConfig,
  EsmConfig,
  FormatCounts,
  FormatOutputs,
  IsWorkspacePackagePredicate,
  WorkspaceBundledDep,
} from './models'
import { from, isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { join, relativePath } from '@hyperfrontend/project-scope/core'
import { runBinPhase } from './bin/run-bin-phase'
import { resolveBundledDeps } from './bundle/dependencies/resolve-bundled-deps'
import { resolveWorkspaceBundledDeps } from './bundle/dependencies/resolve-workspace-bundled-deps'
import { discoverEntries } from './bundle/entries/discover-entries'
import { runBundlePhase } from './bundle/run-bundle-phase'
import { cleanOutputPath } from './clean-output'
import { createMemoryMonitor } from './memory/monitor'
import { recover } from './memory/recover'
import { finalizeFilesAllowlist } from './package/finalize-files'
import { runPackagePhase } from './package/run-package-phase'

const NEVER_WORKSPACE: IsWorkspacePackagePredicate = () => false

/**
 * Reduced view of the format-level `bundleAllDeps` settings collected across every ESM/CJS config.
 */
interface CollectedBundleAllDeps {
  /** `true` when at least one format opts into `bundleAllDeps`. */
  active: boolean
  /** Merged include/exclude lists feeding `resolveBundledDeps`. */
  options: BundleAllDepsOptions
}

const collectFormatBundleAllDeps = (configs: Array<EsmConfig | CjsConfig>): CollectedBundleAllDeps => {
  let active = false
  const include: string[] = []
  const exclude: string[] = []
  for (const cfg of configs) {
    const flag = cfg.bundleAllDeps
    if (!flag) continue
    active = true
    if (typeof flag === 'object') {
      if (flag.include) include.push(...flag.include)
      if (flag.exclude) exclude.push(...flag.exclude)
    }
  }
  return { active, options: { include: from(createSet(include)), exclude: from(createSet(exclude)) } }
}

const toFormatArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : isArray(value) ? <T[]>value : [<T>value])

const computeBundledDeps = (
  config: BuildConfig,
  isWorkspacePackage: IsWorkspacePackagePredicate,
  bundleAllDeps: CollectedBundleAllDeps
): string[] => {
  if (!bundleAllDeps.active) return []
  return resolveBundledDeps(join(config.projectRoot, 'package.json'), {
    isWorkspacePackage,
    include: bundleAllDeps.options.include,
    exclude: bundleAllDeps.options.exclude,
  })
}

const computeWorkspaceBundledDeps = (
  config: BuildConfig,
  isWorkspacePackage: IsWorkspacePackagePredicate,
  bundleAllDeps: CollectedBundleAllDeps
): WorkspaceBundledDep[] => {
  if (!bundleAllDeps.active) return []
  const resolved = resolveWorkspaceBundledDeps(join(config.projectRoot, 'package.json'), config.workspaceRoot, {
    isWorkspacePackage,
    include: bundleAllDeps.options.include,
    exclude: bundleAllDeps.options.exclude,
    policy: config.workspaceDepPolicy,
  })
  return resolved.map((entry) => ({
    packageName: entry.packageName,
    subPath: entry.subPath,
    specifier: entry.specifier,
    inputPath: entry.inputPath,
    tsConfigPath: entry.tsConfigPath,
    policy: entry.policy,
  }))
}

/**
 * Resolves a {@link BuildContext} from a top-level {@link BuildConfig}.
 *
 * Defaults applied:
 * - `outputPath` → `<workspaceRoot>/dist/<projectRelativePath>`
 * - `tsConfigPath` → `<projectRoot>/tsconfig.lib.json`
 * - `external` → `[]`
 * - `assets` → `[]`
 * - `isWorkspacePackage` → predicate that always returns `false`
 *
 * Entry-point discovery is performed against `<projectRoot>/src` exactly once
 * during context creation.
 *
 * @param config - Top-level builder configuration.
 * @returns Resolved context consumed by the bundle, package, and bin phases.
 *
 * @example Building a context manually for a custom orchestrator
 * ```typescript
 * const context = createBuildContext({ projectRoot, workspaceRoot })
 * await runBundlePhase(context, config)
 * ```
 */
export const createBuildContext = (config: BuildConfig): BuildContext => {
  const projectRelativePath = relativePath(config.workspaceRoot, config.projectRoot)
  const isWorkspacePackage = config.isWorkspacePackage ?? NEVER_WORKSPACE
  const formats = [...toFormatArray<EsmConfig>(config.esm), ...toFormatArray<CjsConfig>(config.cjs)]
  const bundleAllDeps = collectFormatBundleAllDeps(formats)
  return {
    projectRoot: config.projectRoot,
    workspaceRoot: config.workspaceRoot,
    projectRelativePath,
    outputPath: config.outputPath ?? join(config.workspaceRoot, 'dist', projectRelativePath),
    tsConfigPath: config.tsConfig ?? join(config.projectRoot, 'tsconfig.lib.json'),
    external: config.external ?? [],
    assets: config.assets ?? [],
    isWorkspacePackage,
    entryPointDiscovery: discoverEntries(config.projectRoot),
    bundledDeps: computeBundledDeps(config, isWorkspacePackage, bundleAllDeps),
    workspaceBundledDeps: computeWorkspaceBundledDeps(config, isWorkspacePackage, bundleAllDeps),
    startedAt: dateNow(),
  }
}

const computeFormatCounts = (formatOutputs: FormatOutputs): FormatCounts => ({
  esm: formatOutputs.esm.length,
  cjs: formatOutputs.cjs.length,
  iife: formatOutputs.iife.length,
  umd: formatOutputs.umd.length,
})

const resolveMonitor = (config: BuildConfig): MemoryMonitor | undefined => {
  if (!config.memoryMonitor) return undefined
  return createMemoryMonitor(typeof config.memoryMonitor === 'object' ? config.memoryMonitor : undefined)
}

/**
 * The single facade that orchestrates a complete build: resolves the context,
 * optionally enables the memory monitor, then runs the bundle, package, and bin
 * phases in order before reflecting `package.json#files` from the materialized
 * output tree. Returns a {@link BuildResult} summarizing what was emitted and
 * how long it took.
 *
 * The memory monitor (when enabled) snapshots before each phase, between
 * phases, and at completion. A failure in any phase still flushes the monitor
 * summary before re-throwing the original error.
 *
 * @param config - Top-level builder configuration.
 * @returns A `BuildResult` with per-format counts, raw format outputs, bin
 * outputs, and total duration in milliseconds.
 * @throws {Error} Whatever any phase throws — the facade does not swallow errors.
 *
 * @example Building a library with workspace-aware externals
 * ```typescript
 * import { build } from '@hyperfrontend/builder'
 * import { byPrefix } from '@hyperfrontend/builder/presets'
 *
 * const result = await build({
 *   projectRoot: '/abs/libs/foo',
 *   workspaceRoot: '/abs/repo',
 *   isWorkspacePackage: byPrefix('@hyperfrontend/'),
 *   esm: { bundleWorkspaceDeps: false },
 *   cjs: { bundleWorkspaceDeps: false },
 * })
 * result.formatCounts.esm // => number of ESM entries emitted
 * ```
 */
export const build = async (config: BuildConfig): Promise<BuildResult> => {
  logger.setLogLevel(config.verbose ? 'debug' : 'error')
  const ctx = createBuildContext(config)
  const monitor = resolveMonitor(config)
  monitor?.logDebug('build:start')
  try {
    // why: empty this project's own output directory up front so the build never inherits stale artifacts from a previous run (e.g. *.js.map left after sourcemaps were disabled, or chunks from since-renamed entries); cleanOutputPath is scoped + guarded to dist/<project> so it can never widen to the whole dist/ or the repo.
    cleanOutputPath(ctx)
    monitor?.check('clean:end')
    const formatOutputs = await runBundlePhase(ctx, config, monitor)
    monitor?.check('bundle:end')
    await recover()
    monitor?.check('bundle:end:post-recover')
    await runPackagePhase(ctx, config, formatOutputs)
    monitor?.check('package:end')
    await recover()
    monitor?.check('package:end:post-recover')
    const binOutputs = await runBinPhase(ctx, config.bin ?? [])
    monitor?.check('bin:end')
    finalizeFilesAllowlist(ctx, config)
    monitor?.check('finalize:end')
    monitor?.logSummary()
    return {
      success: true,
      formatCounts: computeFormatCounts(formatOutputs),
      formatOutputs,
      binOutputs,
      durationMs: dateNow() - ctx.startedAt,
    }
  } catch (error) {
    monitor?.logSummary()
    throw error
  }
}
