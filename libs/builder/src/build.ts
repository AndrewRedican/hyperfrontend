import type { MemoryMonitor } from './memory/monitor'
import type { BuildConfig, BuildContext, BuildResult, FormatCounts, FormatOutputs, IsWorkspacePackagePredicate } from './models'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { join, relativePath } from '@hyperfrontend/project-scope/core'
import { runBinPhase } from './bin/run-bin-phase'
import { discoverEntries } from './bundle/entries/discover-entries'
import { runBundlePhase } from './bundle/run-bundle-phase'
import { createMemoryMonitor } from './memory/monitor'
import { runPackagePhase } from './package/run-package-phase'

const NEVER_WORKSPACE: IsWorkspacePackagePredicate = () => false

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
  return {
    projectRoot: config.projectRoot,
    workspaceRoot: config.workspaceRoot,
    projectRelativePath,
    outputPath: config.outputPath ?? join(config.workspaceRoot, 'dist', projectRelativePath),
    tsConfigPath: config.tsConfig ?? join(config.projectRoot, 'tsconfig.lib.json'),
    external: config.external ?? [],
    assets: config.assets ?? [],
    isWorkspacePackage: config.isWorkspacePackage ?? NEVER_WORKSPACE,
    entryPointDiscovery: discoverEntries(config.projectRoot),
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
 * phases in order. Returns a {@link BuildResult} summarizing what was emitted
 * and how long it took.
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
  const ctx = createBuildContext(config)
  const monitor = resolveMonitor(config)
  monitor?.logDebug('build:start')
  try {
    const formatOutputs = await runBundlePhase(ctx, config)
    monitor?.check('bundle:end')
    await runPackagePhase(ctx, config, formatOutputs)
    monitor?.check('package:end')
    const binOutputs = await runBinPhase(ctx, config.bin ?? [])
    monitor?.check('bin:end')
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
