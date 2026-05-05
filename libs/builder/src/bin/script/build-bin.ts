import type { RollupWorkerInvocation } from '../../bundle/rollup/dispatch'
import type { BinConfig, BinOutput, BinScriptFormat, BuildContext } from '../../models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { ensureDir, join } from '@hyperfrontend/project-scope/core'
import { toBinBuildDescriptor } from '../../bundle/rollup/descriptor'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from '../../bundle/rollup/dispatch'

const log = logger.channel('builder:bin:script')

const normalizeFormats = (format: BinConfig['format']): BinScriptFormat[] => (isArray(format) ? format : [format])

const resolveWorkerOrThrow = (workspaceRoot: string): RollupWorkerInvocation => {
  const invocation = resolveDefaultRollupWorkerPath(workspaceRoot)
  if (!invocation) {
    throw createError(
      'rollup worker could not be resolved for bin script bundling. Build @hyperfrontend/builder at least once before invoking the bin phase, or ensure @swc-node/register is installed for source-mode bootstrap.'
    )
  }
  return invocation
}

/**
 * Builds the JS outputs for a single bin declaration.
 *
 * For each declared format (CJS / ESM), forks a rollup worker that bundles
 * `src/bin/<name>.ts`, prepends the `#!/usr/bin/env node` shebang, appends the
 * resolved bootstrap footer (per-bin override or `defaultBootstrap`), writes
 * the output to `<outputPath>/bin/<name>.<ext>`, and chmods it to `0o755` so
 * the npm bin symlink is invokable. The worker isolates the heavy bin bundle
 * (rollup + plugins + transitive deps loaded into the child) from the parent
 * process — see Phase 11.7.
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
 * @returns One `BinOutput` per emitted JS artifact.
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
  const binDir = join(ctx.outputPath, 'bin')
  ensureDir(binDir)
  const worker = resolveWorkerOrThrow(ctx.workspaceRoot)

  const outputs: BinOutput[] = []
  for (const format of formats) {
    const descriptor = toBinBuildDescriptor(bin, ctx, format, formats, '')
    log.info(`building ${format} bin: ${bin.name}`)
    await dispatchRollupWorker(descriptor, {
      workerPath: worker.path,
      execArgv: worker.execArgv,
      label: `bin:${bin.name}:${format}`,
    })
    outputs.push({ name: bin.name, kind: format, outputPath: <string>descriptor.bin?.outputFile })
  }
  return outputs
}
