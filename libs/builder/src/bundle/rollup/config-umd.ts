import type { OutputOptions, RollupLog, RollupOptions } from 'rollup'
import type { BuildContext, EntryPoint, UmdConfig } from '../../models'
import { join } from '@hyperfrontend/project-scope/core/path'
import { createBundleExternalFn } from '../externals/external-fn'
import { validateExternalsConfig } from '../externals/validate-globals'
import {
  createBrowserNodeResolvePlugin,
  createBundleTypescriptPlugin,
  createCommonJsPlugin,
  createJsonPlugin,
  createTerserPlugin,
} from './plugins'

const createUmdOutputs = (
  bundlePath: string,
  globalName: string,
  amdId: string | undefined,
  minify: boolean,
  sourcemap: boolean,
  globals: Record<string, string> | undefined
): OutputOptions[] => {
  const base: Partial<OutputOptions> = { format: 'umd', name: globalName, sourcemap, globals }
  if (amdId) base.amd = { id: amdId }
  const outputs: OutputOptions[] = [{ ...base, file: join(bundlePath, 'index.umd.js') }]
  if (minify) {
    outputs.push({ ...base, file: join(bundlePath, 'index.umd.min.js'), plugins: [createTerserPlugin()] })
  }
  return <OutputOptions[]>outputs
}

const onWarn = (warning: RollupLog, defaultHandler: (warning: RollupLog) => void): void => {
  if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
  if (warning.code === 'EMPTY_BUNDLE') return
  if (warning.code === 'UNRESOLVED_IMPORT') return
  defaultHandler(warning)
}

/**
 * Builds the Rollup configuration for a UMD bundle of a single entry point.
 *
 * UMD bundles inline workspace dependencies via the browser-targeted node-resolve plugin.
 * Use `config.external` + `config.globals` to keep specific packages external (e.g.,
 * `react` mapped to `window.React`).
 *
 * @param entry - Entry point to bundle.
 * @param config - UMD-format configuration.
 * @param context - Resolved build context.
 * @returns Rollup configuration emitting both an unminified and an optional minified output.
 * @throws {Error} When `config.external` is non-empty but `config.globals` is missing entries.
 *
 * @example Producing the rollup config for a UMD bundle
 * ```typescript
 * const rollupConfig = createUmdEntryConfig(entry, { globalName: 'MyLib' }, context)
 * ```
 */
export const createUmdEntryConfig = (entry: EntryPoint, config: UmdConfig, context: BuildContext): RollupOptions => {
  const bundleDir = config.output ?? 'bundle'
  const bundlePath = join(context.outputPath, bundleDir)
  const minify = config.minify ?? true
  const sourcemap = config.sourcemap ?? true

  validateExternalsConfig(config.external, config.globals)

  return {
    input: entry.inputFile,
    external: createBundleExternalFn(config.external),
    onwarn: onWarn,
    plugins: [
      createJsonPlugin(),
      createBrowserNodeResolvePlugin(),
      createCommonJsPlugin(),
      createBundleTypescriptPlugin({
        tsConfigPath: context.tsConfigPath,
        workspaceRoot: context.workspaceRoot,
        bundlePath,
        sourcemap: true,
      }),
    ],
    output: createUmdOutputs(bundlePath, config.globalName, config.amdId, minify, sourcemap, config.globals),
  }
}

/**
 * Builds Rollup configurations for a UMD bundle of every supplied entry point.
 *
 * UMD bundles typically target a single entry; this helper exists for symmetry with the
 * other format builders.
 *
 * @param entries - Entry points to bundle.
 * @param config - UMD-format configuration shared across the entries.
 * @param context - Resolved build context.
 * @returns One Rollup configuration per entry.
 *
 * @example Producing rollup configs for the root entry of a bundle
 * ```typescript
 * const configs = createUmdConfig([entry], { globalName: 'MyLib' }, context)
 * ```
 */
export const createUmdConfig = (entries: EntryPoint[], config: UmdConfig, context: BuildContext): RollupOptions[] =>
  entries.map((entry) => createUmdEntryConfig(entry, config, context))
