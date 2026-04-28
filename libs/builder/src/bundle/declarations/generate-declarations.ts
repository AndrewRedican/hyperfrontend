import type { BuildContext } from '../../models'
import { spawnSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core/path'
import { flattenDeclarationPaths } from './flatten-paths'

const log = logger.channel('builder:bundle:declarations')

/**
 * Result of running tsc to emit declaration files.
 */
export interface GenerateDeclarationsResult {
  /** Whether the tsc invocation succeeded. */
  success: boolean
  /** Captured stdout content from tsc. */
  stdout: string
  /** Captured stderr content from tsc. */
  stderr: string
}

/**
 * Generates `.d.ts` and `.d.ts.map` files for every entry point in the project
 * by spawning the workspace-local TypeScript compiler.
 *
 * After tsc finishes, calls `flattenDeclarationPaths` to relocate the nested
 * `dist/<lib>/libs/<lib>/src/...` structure that tsc emits with `baseUrl=workspaceRoot`
 * back into the flat per-library shape consumers expect.
 *
 * @param context - Resolved build context. Provides project root, output path, tsconfig path,
 * workspace root, and entry point discovery for the flatten step.
 * @returns Result containing tsc's exit status, captured stdout, and captured stderr.
 * @throws {Error} When tsc exits with a non-zero status or fails to spawn.
 *
 * @example Generating declarations as part of a custom build
 * ```typescript
 * const result = generateDeclarations(context)
 * console.log(result.stdout)
 * ```
 */
export const generateDeclarations = (context: BuildContext): GenerateDeclarationsResult => {
  log.info('generating typescript declarations')
  const tscPath = join(context.workspaceRoot, 'node_modules', '.bin', 'tsc')
  const args = [
    '--project',
    context.tsConfigPath,
    '--noEmit',
    'false',
    '--emitDeclarationOnly',
    '--declaration',
    '--declarationMap',
    '--outDir',
    context.outputPath,
  ]

  const result = spawnSync(tscPath, args, {
    cwd: context.projectRoot,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (result.error) {
    log.error(`tsc spawn error: ${result.error.message}`)
    throw result.error
  }
  if (result.status !== 0) {
    throw createError(`tsc failed with exit code ${result.status}`)
  }

  flattenDeclarationPaths(context)
  return { success: true, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}
