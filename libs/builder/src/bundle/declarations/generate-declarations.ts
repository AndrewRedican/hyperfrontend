import type { BuildContext } from '../../models'
import { spawn } from 'node:child_process'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core/path'
import { flattenDeclarationPaths } from './flatten-paths'

const log = logger.channel('builder:bundle:declarations')

const HEARTBEAT_INTERVAL_MS = 5000
const BYTES_PER_MB = 1024 * 1024
const formatMB = (bytes: number): string => (bytes / BYTES_PER_MB).toFixed(1)

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

const startHeartbeat = (label: string, startedAt: number): ReturnType<typeof setInterval> =>
  setInterval(() => {
    const usage = process.memoryUsage()
    const elapsedSec = ((dateNow() - startedAt) / 1000).toFixed(1)
    log.info(`${label} still running: elapsed=${elapsedSec}s parent heap=${formatMB(usage.heapUsed)}MB rss=${formatMB(usage.rss)}MB`)
  }, HEARTBEAT_INTERVAL_MS)

const runTsc = (tscPath: string, args: string[], cwd: string): Promise<GenerateDeclarationsResult> =>
  createPromise<GenerateDeclarationsResult>((resolve, reject) => {
    const startedAt = dateNow()
    const child = spawn(tscPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    log.info(`tsc spawned: pid=${child.pid ?? 'unknown'}`)
    log.debug(`tsc args: ${args.join(' ')}`)
    const heartbeat = startHeartbeat('tsc', startedAt)
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
      clearInterval(heartbeat)
      log.error(`tsc spawn error: ${error.message}`)
      reject(error)
    })
    child.on('close', (code) => {
      clearInterval(heartbeat)
      const durationMs = dateNow() - startedAt
      if (code !== 0) {
        log.error(`tsc failed with exit code ${code} after ${durationMs}ms`)
        reject(createError(`tsc failed with exit code ${code}`))
        return
      }
      log.info(`tsc exited 0 in ${durationMs}ms`)
      resolve({ success: true, stdout, stderr })
    })
  })

/**
 * Generates `.d.ts` and `.d.ts.map` files for every entry point in the project
 * by spawning the workspace-local TypeScript compiler.
 *
 * Streams tsc's stdout to `log.debug` and stderr to `log.warn` as the child
 * runs so the parent event loop stays free for memory-monitor checkpoints and
 * progress is observable in real time. Logs the parent process's heap and RSS
 * before the spawn, emits a heartbeat every 5 s while tsc is alive, and reports
 * the exit code with elapsed duration on completion.
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
  const usage = process.memoryUsage()
  log.info(`pre-tsc memory: parent heap=${formatMB(usage.heapUsed)}MB rss=${formatMB(usage.rss)}MB`)
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
  log.info('flattening declaration paths')
  const flattenStart = dateNow()
  flattenDeclarationPaths(context)
  log.info(`flatten complete in ${dateNow() - flattenStart}ms`)
  return result
}
