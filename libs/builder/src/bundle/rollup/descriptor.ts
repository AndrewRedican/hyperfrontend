import type { BuildContext, CjsConfig, EntryPoint, EsmConfig, IifeConfig, UmdConfig } from '../../models'
import type { RollupBuildDescriptor } from './worker/types'
import { join } from '@hyperfrontend/project-scope/core/path'
import { resolveExternals } from '../externals/resolve-externals'
import { validateExternalsConfig } from '../externals/validate-globals'

const computeEntryOutputDir = (entry: EntryPoint, context: BuildContext): string =>
  entry.srcPath ? join(context.outputPath, entry.srcPath) : context.outputPath

const computeBundleOutputDir = (bundleSubDir: string | undefined, context: BuildContext): string =>
  join(context.outputPath, bundleSubDir ?? 'bundle')

/**
 * Builds the worker descriptor for the ESM output of a single entry point.
 *
 * Produces a fully serializable shape: every function-valued field on the
 * format config (e.g., `isWorkspacePackage`) is pre-evaluated by the parent
 * before assembling the descriptor.
 *
 * @param entry - Entry point to compile.
 * @param config - ESM-format configuration.
 * @param context - Resolved build context.
 * @param reportPath - Absolute path the worker will write its JSON report to.
 * @returns Descriptor ready to be JSON-serialized for the worker.
 *
 * @example Producing the descriptor for the root entry
 * ```typescript
 * const descriptor = toEsmBuildDescriptor(entry, esmConfig, context, '/tmp/report.json')
 * ```
 */
export const toEsmBuildDescriptor = (
  entry: EntryPoint,
  config: EsmConfig,
  context: BuildContext,
  reportPath: string
): RollupBuildDescriptor => {
  const outputDir = computeEntryOutputDir(entry, context)
  const sourcemap = config.sourcemap ?? true
  const useBundleAllDeps = Boolean(config.bundleAllDeps) && context.bundledDeps.length > 0
  const bundledDeps = useBundleAllDeps ? context.bundledDeps : []
  const external = resolveExternals({
    packageJsonPath: join(context.projectRoot, 'package.json'),
    additional: [...context.external, ...(config.external ?? [])],
    isWorkspacePackage: context.isWorkspacePackage,
    bundleWorkspaceDeps: config.bundleWorkspaceDeps,
    bundledDeps,
  })
  return {
    format: 'esm',
    inputFile: entry.inputFile,
    outputDir,
    external,
    sourcemap,
    bundledDepsPlugin: useBundleAllDeps ? { deps: bundledDeps, depsRoot: join(context.outputPath, '_dependencies') } : null,
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps: config.bundleWorkspaceDeps,
    bundle: null,
    reportPath,
  }
}

/**
 * Builds the worker descriptor for the CommonJS output of a single entry point.
 *
 * @param entry - Entry point to compile.
 * @param config - CJS-format configuration.
 * @param context - Resolved build context.
 * @param reportPath - Absolute path the worker will write its JSON report to.
 * @returns Descriptor ready to be JSON-serialized for the worker.
 *
 * @example Producing the descriptor for the root entry
 * ```typescript
 * const descriptor = toCjsBuildDescriptor(entry, cjsConfig, context, '/tmp/report.json')
 * ```
 */
export const toCjsBuildDescriptor = (
  entry: EntryPoint,
  config: CjsConfig,
  context: BuildContext,
  reportPath: string
): RollupBuildDescriptor => {
  const outputDir = computeEntryOutputDir(entry, context)
  const sourcemap = config.sourcemap ?? true
  const useBundleAllDeps = Boolean(config.bundleAllDeps) && context.bundledDeps.length > 0
  const bundledDeps = useBundleAllDeps ? context.bundledDeps : []
  const external = resolveExternals({
    packageJsonPath: join(context.projectRoot, 'package.json'),
    additional: [...context.external, ...(config.external ?? [])],
    isWorkspacePackage: context.isWorkspacePackage,
    bundleWorkspaceDeps: config.bundleWorkspaceDeps,
    bundledDeps,
  })
  return {
    format: 'cjs',
    inputFile: entry.inputFile,
    outputDir,
    external,
    sourcemap,
    bundledDepsPlugin: useBundleAllDeps ? { deps: bundledDeps, depsRoot: join(context.outputPath, '_dependencies') } : null,
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps: config.bundleWorkspaceDeps,
    bundle: null,
    reportPath,
  }
}

/**
 * Builds the worker descriptor for an IIFE bundle of a single entry point.
 *
 * Validates the externals/globals pairing eagerly so the parent fails before
 * any worker is forked.
 *
 * @param entry - Entry point to bundle.
 * @param config - IIFE-format configuration.
 * @param context - Resolved build context.
 * @param reportPath - Absolute path the worker will write its JSON report to.
 * @returns Descriptor ready to be JSON-serialized for the worker.
 * @throws {Error} When `config.external` is non-empty but `config.globals` is missing entries.
 *
 * @example Producing the descriptor for an IIFE bundle
 * ```typescript
 * const descriptor = toIifeBuildDescriptor(entry, iifeConfig, context, '/tmp/report.json')
 * ```
 */
export const toIifeBuildDescriptor = (
  entry: EntryPoint,
  config: IifeConfig,
  context: BuildContext,
  reportPath: string
): RollupBuildDescriptor => {
  validateExternalsConfig(config.external, config.globals)
  const outputDir = computeBundleOutputDir(config.output, context)
  const sourcemap = config.sourcemap ?? true
  const minify = config.minify ?? true
  return {
    format: 'iife',
    inputFile: entry.inputFile,
    outputDir,
    external: config.external ?? [],
    sourcemap,
    bundledDepsPlugin: null,
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps: false,
    bundle: { globalName: config.globalName, minify, globals: config.globals },
    reportPath,
  }
}

/**
 * Builds the worker descriptor for a UMD bundle of a single entry point.
 *
 * Validates the externals/globals pairing eagerly so the parent fails before
 * any worker is forked.
 *
 * @param entry - Entry point to bundle.
 * @param config - UMD-format configuration.
 * @param context - Resolved build context.
 * @param reportPath - Absolute path the worker will write its JSON report to.
 * @returns Descriptor ready to be JSON-serialized for the worker.
 * @throws {Error} When `config.external` is non-empty but `config.globals` is missing entries.
 *
 * @example Producing the descriptor for a UMD bundle
 * ```typescript
 * const descriptor = toUmdBuildDescriptor(entry, umdConfig, context, '/tmp/report.json')
 * ```
 */
export const toUmdBuildDescriptor = (
  entry: EntryPoint,
  config: UmdConfig,
  context: BuildContext,
  reportPath: string
): RollupBuildDescriptor => {
  validateExternalsConfig(config.external, config.globals)
  const outputDir = computeBundleOutputDir(config.output, context)
  const sourcemap = config.sourcemap ?? true
  const minify = config.minify ?? true
  return {
    format: 'umd',
    inputFile: entry.inputFile,
    outputDir,
    external: config.external ?? [],
    sourcemap,
    bundledDepsPlugin: null,
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps: false,
    bundle: { globalName: config.globalName, minify, globals: config.globals, amdId: config.amdId },
    reportPath,
  }
}
