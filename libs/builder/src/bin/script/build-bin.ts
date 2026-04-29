import type { OutputOptions, RollupLog, RollupOptions } from 'rollup'
import type { BinConfig, BinOutput, BinScriptFormat, BuildContext } from '../../models'
import { chmodSync } from 'node:fs'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, join } from '@hyperfrontend/project-scope/core'
import { executeRollup } from '../../bundle/rollup/execute'
import { createCommonJsPlugin, createJsonPlugin, createNodeResolvePlugin, createTypescriptPlugin } from '../../bundle/rollup/plugins'
import { defaultBootstrap } from './bootstrap-footer'

const log = logger.channel('builder:bin:script')

const SHEBANG = '#!/usr/bin/env node'
const BIN_FILE_MODE = 0o755

const onWarn = (warning: RollupLog, defaultHandler: (warning: RollupLog) => void): void => {
  if (warning.plugin === 'typescript' && warning.message?.includes('TS2307')) return
  if (warning.code === 'EMPTY_BUNDLE') return
  defaultHandler(warning)
}

const normalizeFormats = (format: BinConfig['format']): BinScriptFormat[] => (isArray(format) ? format : [format])

const resolveOutputFile = (binDir: string, name: string, format: BinScriptFormat, formats: BinScriptFormat[]): string => {
  if (format === 'esm') return join(binDir, `${name}.mjs`)
  return formats.length === 1 ? join(binDir, `${name}.js`) : join(binDir, `${name}.cjs.js`)
}

const resolveBootstrap = (bin: BinConfig, format: BinScriptFormat): string =>
  bin.bootstrap ?? defaultBootstrap({ runner: bin.runner ?? 'default', format })

const createOutput = (file: string, format: BinScriptFormat, footer: string): OutputOptions => ({
  file,
  format: format === 'esm' ? 'esm' : 'cjs',
  exports: 'named',
  banner: SHEBANG,
  footer,
  sourcemap: false,
})

const createRollupConfig = (input: string, output: OutputOptions, ctx: BuildContext, binDir: string): RollupOptions => ({
  input,
  onwarn: onWarn,
  plugins: [
    createJsonPlugin(),
    createNodeResolvePlugin(),
    createCommonJsPlugin(),
    createTypescriptPlugin({
      tsConfigPath: ctx.tsConfigPath,
      projectRoot: ctx.projectRoot,
      outputPath: binDir,
      sourcemap: false,
      bundleWorkspaceDeps: true,
      workspaceRoot: ctx.workspaceRoot,
    }),
  ],
  output,
})

/**
 * Builds the JS outputs for a single bin declaration.
 *
 * For each declared format (CJS / ESM), bundles `src/bin/<name>.ts` with Rollup,
 * prepends the `#!/usr/bin/env node` shebang, appends the resolved bootstrap footer
 * (per-bin override or {@link defaultBootstrap}), writes the output to
 * `<outputPath>/bin/<name>.<ext>`, and chmods it to `0o755` so the npm bin symlink
 * is invokable.
 *
 * Output naming follows the convention:
 * - ESM: `<name>.mjs`
 * - CJS only: `<name>.js`
 * - CJS alongside ESM: `<name>.cjs.js`
 *
 * Workspace dependencies are always inlined into bin bundles — bins are intended
 * to ship as self-contained executable scripts.
 *
 * @param bin - Bin declaration including name, format(s), optional runner override, and bootstrap override.
 * @param ctx - Resolved build context.
 * @returns One {@link BinOutput} per emitted JS artifact.
 *
 * @example Building a CJS-only bin
 * ```typescript
 * const outputs = await buildJsBin({ name: 'cz', format: 'cjs', runner: 'runCz' }, context)
 * ```
 *
 * @example Building dual CJS + ESM outputs
 * ```typescript
 * const outputs = await buildJsBin({ name: 'hf-build', format: ['cjs', 'esm'] }, context)
 * ```
 */
export const buildJsBin = async (bin: BinConfig, ctx: BuildContext): Promise<BinOutput[]> => {
  const formats = normalizeFormats(bin.format)
  const inputFile = join(ctx.projectRoot, 'src', 'bin', `${bin.name}.ts`)
  const binDir = join(ctx.outputPath, 'bin')
  ensureDir(binDir)

  const outputs: BinOutput[] = []
  for (const format of formats) {
    const outputFile = resolveOutputFile(binDir, bin.name, format, formats)
    const footer = resolveBootstrap(bin, format)
    log.info(`building ${format} bin: ${bin.name}`)
    await executeRollup(createRollupConfig(inputFile, createOutput(outputFile, format, footer), ctx, binDir), `bin:${bin.name}:${format}`)
    chmodSync(outputFile, BIN_FILE_MODE)
    outputs.push({ name: bin.name, kind: format, outputPath: outputFile })
  }
  return outputs
}
