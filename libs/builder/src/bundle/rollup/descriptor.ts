import type { BinConfig, BinScriptFormat, BuildContext, CjsConfig, EntryPoint, EsmConfig, IifeConfig, UmdConfig } from '../../models'
import type { RollupBuildDescriptor } from './worker/types'
import { getDirname, join } from '@hyperfrontend/project-scope/core/path'
import { defaultBootstrap } from '../../bin/script/bootstrap-footer'
import { buildWorkspaceRoutes } from '../dependencies/externalize-plugin'
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
  const sourcemap = config.sourcemap ?? false
  const bundleWorkspaceDeps = config.bundleWorkspaceDeps ?? true
  const bundleAllRequested = Boolean(config.bundleAllDeps)
  const bundledDeps = bundleAllRequested ? context.bundledDeps : []
  const workspaceRoutes = bundleAllRequested ? buildWorkspaceRoutes(context.workspaceBundledDeps) : []
  const useExternalizePlugin = bundledDeps.length > 0 || workspaceRoutes.length > 0
  const external = resolveExternals({
    packageJsonPath: join(context.projectRoot, 'package.json'),
    additional: [...context.external, ...(config.external ?? [])],
    isWorkspacePackage: context.isWorkspacePackage,
    bundleWorkspaceDeps,
    bundledDeps,
    workspaceBundledDepNames: workspaceRoutes.map((r) => r.packageName),
  })
  return {
    format: 'esm',
    inputFile: entry.inputFile,
    outputDir,
    external,
    sourcemap,
    bundledDepsPlugin: useExternalizePlugin ? { deps: bundledDeps, depsRoot: join(context.outputPath, '_dependencies') } : null,
    workspaceRoutes,
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps,
    bundle: null,
    bin: null,
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
  const sourcemap = config.sourcemap ?? false
  const bundleWorkspaceDeps = config.bundleWorkspaceDeps ?? true
  const bundleAllRequested = Boolean(config.bundleAllDeps)
  const bundledDeps = bundleAllRequested ? context.bundledDeps : []
  const workspaceRoutes = bundleAllRequested ? buildWorkspaceRoutes(context.workspaceBundledDeps) : []
  const useExternalizePlugin = bundledDeps.length > 0 || workspaceRoutes.length > 0
  const external = resolveExternals({
    packageJsonPath: join(context.projectRoot, 'package.json'),
    additional: [...context.external, ...(config.external ?? [])],
    isWorkspacePackage: context.isWorkspacePackage,
    bundleWorkspaceDeps,
    bundledDeps,
    workspaceBundledDepNames: workspaceRoutes.map((r) => r.packageName),
  })
  return {
    format: 'cjs',
    inputFile: entry.inputFile,
    outputDir,
    external,
    sourcemap,
    bundledDepsPlugin: useExternalizePlugin ? { deps: bundledDeps, depsRoot: join(context.outputPath, '_dependencies') } : null,
    workspaceRoutes,
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps,
    bundle: null,
    bin: null,
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
  const sourcemap = config.sourcemap ?? false
  const minify = config.minify ?? true
  return {
    format: 'iife',
    inputFile: entry.inputFile,
    outputDir,
    external: config.external ?? [],
    sourcemap,
    bundledDepsPlugin: null,
    workspaceRoutes: [],
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps: false,
    bundle: { globalName: config.globalName, minify, globals: config.globals },
    bin: null,
    reportPath,
  }
}

const SHEBANG = '#!/usr/bin/env node'
const BIN_FILE_MODE = 0o755

const resolveBinOutputFile = (binDir: string, name: string, format: BinScriptFormat, formats: BinScriptFormat[]): string => {
  if (format === 'esm') return join(binDir, `${name}.mjs`)
  return formats.length === 1 ? join(binDir, `${name}.js`) : join(binDir, `${name}.cjs.js`)
}

const resolveBinFooter = (bin: BinConfig, format: BinScriptFormat): string =>
  bin.bootstrap ?? defaultBootstrap({ runner: bin.runner ?? 'default', format })

/**
 * Builds the worker descriptor for a single bin output (one (bin, format) pair).
 *
 * Bins are self-contained executable scripts: workspace deps are always inlined,
 * the rollup `external` set is empty (the externalize-bundled-deps plugin
 * intercepts pre-built deps when `bundleAllDeps` is on), and the worker writes
 * directly to `<outputPath>/bin/<name>.<ext>` with the shebang banner, the
 * resolved bootstrap footer, and `chmod 0o755` applied.
 *
 * Output naming follows the existing convention:
 * - ESM: `<name>.mjs`
 * - CJS only: `<name>.js`
 * - CJS alongside ESM: `<name>.cjs.js`
 *
 * @param bin - Bin declaration including name, runner, and per-bin bootstrap override.
 * @param context - Resolved build context.
 * @param format - Format being built (one of `bin.format`'s entries).
 * @param formats - Full list of formats requested for this bin (drives the CJS filename).
 * @param reportPath - Absolute path the worker will write its JSON report to.
 * @returns Descriptor ready to be JSON-serialized for the worker.
 *
 * @example Producing the descriptor for an `hf-build` CJS bin alongside an ESM twin
 * ```typescript
 * const descriptor = toBinBuildDescriptor(bin, context, 'cjs', ['cjs', 'esm'], '/tmp/r.json')
 * ```
 */
export const toBinBuildDescriptor = (
  bin: BinConfig,
  context: BuildContext,
  format: BinScriptFormat,
  formats: BinScriptFormat[],
  reportPath: string
): RollupBuildDescriptor => {
  const inputFile = join(context.projectRoot, 'src', 'bin', `${bin.name}.ts`)
  const binDir = join(context.outputPath, 'bin')
  const outputFile = resolveBinOutputFile(binDir, bin.name, format, formats)
  const bundledDepsRoot = join(context.outputPath, '_dependencies')
  const workspaceRoutes = buildWorkspaceRoutes(context.workspaceBundledDeps)
  const useExternalizePlugin = context.bundledDeps.length > 0 || workspaceRoutes.length > 0
  return {
    format,
    inputFile,
    outputDir: getDirname(outputFile),
    external: [],
    sourcemap: false,
    bundledDepsPlugin: useExternalizePlugin ? { deps: context.bundledDeps, depsRoot: bundledDepsRoot } : null,
    workspaceRoutes,
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps: true,
    bundle: null,
    bin: {
      outputFile,
      banner: SHEBANG,
      footer: resolveBinFooter(bin, format),
      exports: 'named',
      inlineDynamicImports: true,
      chmod: BIN_FILE_MODE,
    },
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
  const sourcemap = config.sourcemap ?? false
  const minify = config.minify ?? true
  return {
    format: 'umd',
    inputFile: entry.inputFile,
    outputDir,
    external: config.external ?? [],
    sourcemap,
    bundledDepsPlugin: null,
    workspaceRoutes: [],
    tsConfigPath: context.tsConfigPath,
    projectRoot: context.projectRoot,
    workspaceRoot: context.workspaceRoot,
    bundleWorkspaceDeps: false,
    bundle: { globalName: config.globalName, minify, globals: config.globals, amdId: config.amdId },
    bin: null,
    reportPath,
  }
}
