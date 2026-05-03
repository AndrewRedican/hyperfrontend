import type { BuildContext } from '../../models'
import { spawn } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
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

const runTsc = (tscPath: string, args: string[], cwd: string): Promise<GenerateDeclarationsResult> =>
  createPromise<GenerateDeclarationsResult>((resolve, reject) => {
    const child = spawn(tscPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString()
      stdout += text
      log.debug(text.trimEnd())
    })
    child.stderr.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString()
      stderr += text
      log.warn(text.trimEnd())
    })
    child.on('error', (error) => {
      log.error(`tsc spawn error: ${error.message}`)
      reject(error)
    })
    child.on('close', (code) => {
      if (code !== 0) {
        reject(createError(`tsc failed with exit code ${code}`))
        return
      }
      resolve({ success: true, stdout, stderr })
    })
  })

/**
 * Generates `.d.ts` and `.d.ts.map` files for every entry point in the project
 * by spawning the workspace-local TypeScript compiler.
 *
 * Streams tsc's stdout to `log.debug` and stderr to `log.warn` as the child
 * runs so the parent event loop stays free for memory-monitor checkpoints and
 * progress is observable in real time.
 *
 * After tsc finishes, calls `flattenDeclarationPaths` to relocate the nested
 * `dist/<lib>/libs/<lib>/src/...` structure that tsc emits with `baseUrl=workspaceRoot`
 * back into the flat per-library shape consumers expect.
 *
 * @param context - Resolved build context. Provides project root, output path, tsconfig path,
 * workspace root, and entry point discovery for the flatten step.
 * @returns Promise resolving with tsc's exit status, captured stdout, and captured stderr.
 * @throws {Error} When tsc exits with a non-zero status or fails to spawn.
 *
 * @example Generating declarations as part of a custom build
 * ```typescript
 * const result = await generateDeclarations(context)
 * console.log(result.stdout)
 * ```
 */
export const generateDeclarations = async (context: BuildContext): Promise<GenerateDeclarationsResult> => {
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

  const result = await runTsc(tscPath, args, context.projectRoot)
  flattenDeclarationPaths(context)
  return result
}
