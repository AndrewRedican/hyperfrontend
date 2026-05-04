import type { OutputOptions, Plugin, RollupLog, RollupOptions } from 'rollup'
import type { BuildContext, CjsConfig, EntryPoint } from '../../models'
import { join } from '@hyperfrontend/project-scope/core/path'
import { createExternalizeBundledDepsPlugin } from '../dependencies/externalize-plugin'
import { createExternalFn } from '../externals/external-fn'
import { resolveExternals } from '../externals/resolve-externals'
import { createCommonJsPlugin, createJsonPlugin, createNodeResolvePlugin, createTypescriptPlugin } from './plugins'

const createCjsOutput = (outputPath: string, sourcemap: boolean): OutputOptions => ({
  file: join(outputPath, 'index.cjs.js'),
  format: 'cjs',
  sourcemap,
})

const onWarn = (warning: RollupLog, defaultHandler: (warning: RollupLog) => void): void => {
  if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
  if (warning.code === 'EMPTY_BUNDLE') return
  defaultHandler(warning)
}

/**
 * Builds the Rollup configuration for the CommonJS output of a single entry point.
 *
 * @param entry - Entry point to compile.
 * @param config - CJS-format configuration.
 * @param context - Resolved build context.
 * @returns Rollup configuration.
 *
 * @example Producing the rollup config for the root entry
 * ```typescript
 * const rollupConfig = createCjsEntryConfig(entry, { bundleWorkspaceDeps: false }, context)
 * ```
 */
export const createCjsEntryConfig = (entry: EntryPoint, config: CjsConfig, context: BuildContext): RollupOptions => {
  const entryOutputPath = entry.srcPath ? join(context.outputPath, entry.srcPath) : context.outputPath
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

  const plugins: Plugin[] = []
  if (useBundleAllDeps) {
    plugins.push(
      createExternalizeBundledDepsPlugin({
        deps: bundledDeps,
        entryOutDir: entryOutputPath,
        format: 'cjs',
        depsRoot: join(context.outputPath, '_dependencies'),
      })
    )
  }
  plugins.push(
    createJsonPlugin(),
    createNodeResolvePlugin(),
    createCommonJsPlugin(),
    createTypescriptPlugin({
      tsConfigPath: context.tsConfigPath,
      projectRoot: context.projectRoot,
      outputPath: entryOutputPath,
      sourcemap,
      bundleWorkspaceDeps: config.bundleWorkspaceDeps,
      workspaceRoot: context.workspaceRoot,
    })
  )

  return {
    input: entry.inputFile,
    external: createExternalFn(external),
    onwarn: onWarn,
    plugins,
    output: createCjsOutput(entryOutputPath, sourcemap),
  }
}

/**
 * Builds the Rollup configuration for the CommonJS output of every supplied entry point.
 *
 * @param entries - Entry points to compile.
 * @param config - CJS-format configuration shared across the entries.
 * @param context - Resolved build context.
 * @returns One Rollup configuration per entry.
 *
 * @example Producing rollup configs for every discovered entry
 * ```typescript
 * const configs = createCjsConfig(discovery.entryPoints, { bundleWorkspaceDeps: false }, context)
 * ```
 */
export const createCjsConfig = (entries: EntryPoint[], config: CjsConfig, context: BuildContext): RollupOptions[] =>
  entries.map((entry) => createCjsEntryConfig(entry, config, context))
