import type { RollupOptions, OutputOptions, RollupLog } from 'rollup'
import { join } from 'node:path'
import type { EntryPoint, UMDConfig, BuildContext } from './types'
import {
  createBrowserNodeResolvePlugin,
  createCommonJsPlugin,
  createBundleTypescriptPlugin,
  createJsonPlugin,
  createTerserPlugin,
} from './rollup-plugins'
import { createBundleExternalFn, validateExternalsConfig } from './externals'

/**
 * Creates UMD output configurations for a bundle.
 *
 * @param bundlePath - Absolute path to bundle output directory
 * @param globalName - Global variable name
 * @param amdId - AMD module ID (optional)
 * @param minify - Whether to generate minified version
 * @param sourcemap - Whether to generate sourcemaps
 * @param globals - Mapping of external dependencies to global variable names
 * @returns Array of Rollup output configurations
 */
function createUMDOutputConfigs(
  bundlePath: string,
  globalName: string,
  amdId: string | undefined,
  minify: boolean,
  sourcemap: boolean,
  globals: Record<string, string> | undefined
): OutputOptions[] {
  const baseOptions: Partial<OutputOptions> = {
    format: 'umd',
    name: globalName,
    sourcemap,
    globals,
  }

  if (amdId) {
    baseOptions.amd = { id: amdId }
  }

  const outputs: OutputOptions[] = [
    {
      ...baseOptions,
      file: join(bundlePath, 'index.umd.js'),
    },
  ]

  if (minify) {
    outputs.push({
      ...baseOptions,
      file: join(bundlePath, 'index.umd.min.js'),
      plugins: [createTerserPlugin()],
    })
  }

  return <OutputOptions[]>outputs
}

/**
 * Creates Rollup configuration for UMD bundle output.
 *
 * @param entry - Entry point to bundle
 * @param config - UMD configuration
 * @param context - Build context
 * @returns Rollup configuration
 */
export function createUMDEntryConfig(entry: EntryPoint, config: UMDConfig, context: BuildContext): RollupOptions {
  const { outputPath, tsConfigPath, workspaceRoot } = context
  const bundleDir = config.output ?? 'bundle'
  const bundlePath = join(outputPath, bundleDir)
  const minify = config.minify ?? true
  const sourcemap = config.sourcemap ?? true
  const amdId = config.amdId

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

    output: createUMDOutputConfigs(bundlePath, config.globalName, amdId, minify, sourcemap, config.globals),
  }
}

/**
 * Creates Rollup configurations for UMD bundle output of all specified entries.
 * Note: UMD typically targets a single entry point.
 *
 * @param entries - Entry points to bundle
 * @param config - UMD configuration
 * @param context - Build context
 * @returns Array of Rollup configurations
 */
export function createUMDConfig(entries: EntryPoint[], config: UMDConfig, context: BuildContext): RollupOptions[] {
  return entries.map((entry) => createUMDEntryConfig(entry, config, context))
}
