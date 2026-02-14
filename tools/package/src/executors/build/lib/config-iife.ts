import type { RollupOptions, OutputOptions, RollupLog } from 'rollup'
import { join } from 'node:path'
import type { EntryPoint, IIFEConfig, BuildContext } from './types'
import {
  createBrowserNodeResolvePlugin,
  createCommonJsPlugin,
  createBundleTypescriptPlugin,
  createJsonPlugin,
  createTerserPlugin,
} from './rollup-plugins'
import { createBundleExternalFn, validateExternalsConfig } from './externals'

/**
 * Creates IIFE output configurations for a bundle.
 *
 * @param bundlePath - Absolute path to bundle output directory
 * @param globalName - Global variable name
 * @param minify - Whether to generate minified version
 * @param sourcemap - Whether to generate sourcemaps
 * @param globals - Mapping of external dependencies to global variable names
 * @returns Array of Rollup output configurations
 */
function createIIFEOutputConfigs(
  bundlePath: string,
  globalName: string,
  minify: boolean,
  sourcemap: boolean,
  globals: Record<string, string> | undefined
): OutputOptions[] {
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

/**
 * Creates Rollup configuration for IIFE bundle output.
 *
 * @param entry - Entry point to bundle
 * @param config - IIFE configuration
 * @param context - Build context
 * @returns Rollup configuration
 */
export function createIIFEEntryConfig(entry: EntryPoint, config: IIFEConfig, context: BuildContext): RollupOptions {
  const { outputPath, tsConfigPath, workspaceRoot } = context
  const bundleDir = config.output ?? 'bundle'
  const bundlePath = join(outputPath, bundleDir)
  const minify = config.minify ?? true
  const sourcemap = config.sourcemap ?? true

  validateExternalsConfig(config.external, config.globals)
  const isExternal = createBundleExternalFn(config.external)

  return {
    input: entry.inputFile,
    external: isExternal,

    onwarn(warning: RollupLog, defaultHandler: (warning: RollupLog) => void) {
      if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
      if (warning.code === 'EMPTY_BUNDLE') return
      if (warning.code === 'UNRESOLVED_IMPORT' && warning.exporter?.startsWith('@hyperfrontend/')) return
      defaultHandler(warning)
    },

    plugins: [
      createJsonPlugin(),
      createBrowserNodeResolvePlugin(),
      createCommonJsPlugin(),
      createBundleTypescriptPlugin(tsConfigPath, workspaceRoot, bundlePath, true),
    ],

    output: createIIFEOutputConfigs(bundlePath, config.globalName, minify, sourcemap, config.globals),
  }
}

/**
 * Creates Rollup configurations for IIFE bundle output of all specified entries.
 * Note: IIFE typically targets a single entry point.
 *
 * @param entries - Entry points to bundle
 * @param config - IIFE configuration
 * @param context - Build context
 * @returns Array of Rollup configurations
 */
export function createIIFEConfig(entries: EntryPoint[], config: IIFEConfig, context: BuildContext): RollupOptions[] {
  return entries.map((entry) => createIIFEEntryConfig(entry, config, context))
}
