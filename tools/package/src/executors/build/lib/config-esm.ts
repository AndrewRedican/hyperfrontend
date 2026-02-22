import type { RollupOptions, OutputOptions, RollupLog } from 'rollup'
import { join } from 'node:path'
import type { EntryPoint, ESMConfig, BuildContext } from './types'
import { createNodeResolvePlugin, createCommonJsPlugin, createTypescriptPlugin, createJsonPlugin } from './rollup-plugins'
import { createExternalFn, getExternalDependencies, getPackageJsonPath } from './externals'

/**
 * Creates ESM output configuration for a single entry point.
 *
 * @param outputPath - Absolute path to the entry output directory
 * @param entryName - Name for the output file (default: 'index')
 * @param sourcemap - Whether to generate sourcemaps
 * @returns Rollup output configuration
 */
function createESMOutputConfig(outputPath: string, entryName = 'index', sourcemap = true): OutputOptions {
  return {
    file: join(outputPath, `${entryName}.esm.js`),
    format: 'esm',
    sourcemap,
  }
}

/**
 * Creates Rollup configuration for ESM output of a single entry point.
 *
 * @param entry - Entry point to build
 * @param config - ESM configuration
 * @param context - Build context
 * @returns Rollup configuration
 */
export function createESMEntryConfig(entry: EntryPoint, config: ESMConfig, context: BuildContext): RollupOptions {
  const { projectRoot, outputPath, tsConfigPath, workspaceRoot } = context
  const entryOutputPath = entry.srcPath ? join(outputPath, entry.srcPath) : outputPath
  const sourcemap = config.sourcemap ?? true
  const { bundleWorkspaceDeps } = config

  const packageJsonPath = getPackageJsonPath(projectRoot)
  const external = getExternalDependencies(packageJsonPath, config.external, bundleWorkspaceDeps)
  const isExternal = createExternalFn(external)

  return {
    input: entry.inputFile,
    external: isExternal,

    onwarn(warning: RollupLog, defaultHandler: (warning: RollupLog) => void) {
      if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
      if (warning.code === 'EMPTY_BUNDLE') return
      defaultHandler(warning)
    },

    plugins: [
      createJsonPlugin(),
      createNodeResolvePlugin(bundleWorkspaceDeps),
      createCommonJsPlugin(),
      createTypescriptPlugin(tsConfigPath, projectRoot, entryOutputPath, sourcemap, bundleWorkspaceDeps, workspaceRoot),
    ],

    output: createESMOutputConfig(entryOutputPath, 'index', sourcemap),
  }
}

/**
 * Creates Rollup configurations for ESM output of all specified entries.
 *
 * @param entries - Entry points to build
 * @param config - ESM configuration
 * @param context - Build context
 * @returns Array of Rollup configurations
 */
export function createESMConfig(entries: EntryPoint[], config: ESMConfig, context: BuildContext): RollupOptions[] {
  return entries.map((entry) => createESMEntryConfig(entry, config, context))
}
