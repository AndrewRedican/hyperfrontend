import type { RollupOptions, OutputOptions, RollupLog } from 'rollup'
import { join } from 'node:path'
import type { EntryPoint, CJSConfig, BuildContext } from './types'
import { createNodeResolvePlugin, createCommonJsPlugin, createTypescriptPlugin, createJsonPlugin } from './rollup-plugins'
import { createExternalFn, getExternalDependencies, getPackageJsonPath } from './externals'

/**
 * Creates CJS output configuration for a single entry point.
 *
 * @param outputPath - Absolute path to the entry output directory
 * @param entryName - Name for the output file (default: 'index')
 * @param sourcemap - Whether to generate sourcemaps
 * @returns Rollup output configuration
 */
function createCJSOutputConfig(outputPath: string, entryName = 'index', sourcemap = true): OutputOptions {
  return {
    file: join(outputPath, `${entryName}.cjs.js`),
    format: 'cjs',
    sourcemap,
  }
}

/**
 * Creates Rollup configuration for CJS output of a single entry point.
 *
 * @param entry - Entry point to build
 * @param config - CJS configuration
 * @param context - Build context
 * @returns Rollup configuration
 */
export function createCJSEntryConfig(entry: EntryPoint, config: CJSConfig, context: BuildContext): RollupOptions {
  const { projectRoot, outputPath, tsConfigPath } = context
  const entryOutputPath = entry.srcPath ? join(outputPath, entry.srcPath) : outputPath
  const sourcemap = config.sourcemap ?? true

  const packageJsonPath = getPackageJsonPath(projectRoot)
  const external = getExternalDependencies(packageJsonPath, config.external)
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
      createNodeResolvePlugin(),
      createCommonJsPlugin(),
      createTypescriptPlugin(tsConfigPath, projectRoot, entryOutputPath, false, sourcemap),
    ],

    output: createCJSOutputConfig(entryOutputPath, 'index', sourcemap),
  }
}

/**
 * Creates Rollup configurations for CJS output of all specified entries.
 *
 * @param entries - Entry points to build
 * @param config - CJS configuration
 * @param context - Build context
 * @returns Array of Rollup configurations
 */
export function createCJSConfig(entries: EntryPoint[], config: CJSConfig, context: BuildContext): RollupOptions[] {
  return entries.map((entry) => createCJSEntryConfig(entry, config, context))
}
