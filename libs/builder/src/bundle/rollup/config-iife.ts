import type { OutputOptions, RollupLog, RollupOptions } from 'rollup'
import type { BuildContext, EntryPoint, IifeConfig } from '../../models'
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

const createIifeOutputs = (
  bundlePath: string,
  globalName: string,
  minify: boolean,
  sourcemap: boolean,
  globals: Record<string, string> | undefined
): OutputOptions[] => {
  const outputs: OutputOptions[] = [
    {
      file: join(bundlePath, 'index.iife.js'),
      format: 'iife',
      name: globalName,
      sourcemap,
      globals,
    },
  ]
  if (minify) {
    outputs.push({
      file: join(bundlePath, 'index.iife.min.js'),
      format: 'iife',
      name: globalName,
      sourcemap,
      globals,
      plugins: [createTerserPlugin()],
    })
  }
  return outputs
}

const onWarn = (warning: RollupLog, defaultHandler: (warning: RollupLog) => void): void => {
  if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
  if (warning.code === 'EMPTY_BUNDLE') return
  if (warning.code === 'UNRESOLVED_IMPORT') return
  defaultHandler(warning)
}

/**
 * Builds the Rollup configuration for an IIFE bundle of a single entry point.
 *
 * IIFE bundles always inline workspace dependencies via the browser-targeted
 * node-resolve plugin. Use `config.external` + `config.globals` to keep specific
 * packages external (e.g., `react` mapped to `window.React`).
 *
 * @param entry - Entry point to bundle.
 * @param config - IIFE-format configuration.
 * @param context - Resolved build context.
 * @returns Rollup configuration emitting both an unminified and an optional minified output.
 * @throws {Error} When `config.external` is non-empty but `config.globals` is missing entries.
 *
 * @example Producing the rollup config for an IIFE bundle
 * ```typescript
 * const rollupConfig = createIifeEntryConfig(entry, { globalName: 'MyLib' }, context)
 * ```
 */
export const createIifeEntryConfig = (entry: EntryPoint, config: IifeConfig, context: BuildContext): RollupOptions => {
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
    output: createIifeOutputs(bundlePath, config.globalName, minify, sourcemap, config.globals),
  }
}

/**
 * Builds Rollup configurations for an IIFE bundle of every supplied entry point.
 *
 * IIFE bundles typically target a single entry; this helper exists for symmetry with the
 * other format builders.
 *
 * @param entries - Entry points to bundle.
 * @param config - IIFE-format configuration shared across the entries.
 * @param context - Resolved build context.
 * @returns One Rollup configuration per entry.
 *
 * @example Producing rollup configs for the root entry of a bundle
 * ```typescript
 * const configs = createIifeConfig([entry], { globalName: 'MyLib' }, context)
 * ```
 */
export const createIifeConfig = (entries: EntryPoint[], config: IifeConfig, context: BuildContext): RollupOptions[] =>
  entries.map((entry) => createIifeEntryConfig(entry, config, context))
