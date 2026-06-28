import type { MemoryMonitor } from '../../memory/monitor'
import type { RollupBuildDescriptor, RollupWorkerReport } from './worker/types'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'
import { ascendForWorker } from '../worker-locator'

const log = logger.channel('builder:bundle:rollup:dispatch')

/**
 * Caller-supplied options threaded through {@link dispatchRollupWorker}.
 */
export interface DispatchRollupWorkerOptions {
  /** Absolute path to the worker entry script. Required — see `resolveDefaultRollupWorkerPath`. */
  workerPath: string
  /** Optional memory monitor invoked before and after the spawned worker. */
  monitor?: MemoryMonitor
  /** Override `process.execPath` for the spawned worker (used by tests). */
  execPath?: string
  /** Extra arguments prepended to the worker invocation (e.g. `['--require', '@swc-node/register']`). */
  execArgv?: string[]
  /** Human-readable label for log lines and monitor checkpoints (e.g. `esm:./browser`). */
  label?: string
}

/**
 * Resolved worker invocation: absolute path + any extra Node args (e.g. `--require \@swc-node/register`
 * when the worker is loaded from TypeScript source during a bootstrap build).
 */
export interface RollupWorkerInvocation {
  /** Absolute path to the worker entry script. */
  path: string
  /** Extra args prepended to the spawned child's argv. */
  execArgv: string[]
}

const REPORT_DIR_PREFIX = 'hf-builder-rollup-'

/**
 * Resolves the rollup worker by self-locating it beside the running builder
 * module: ascends from the module's own directory to the builder package root
 * and returns the worker at `bundle/rollup/worker`. This works whether the
 * builder runs from its built dist, an installed `node_modules` copy, or melded
 * into a host bundle under `_dependencies/`. The compiled `index.cjs.js` is
 * preferred; an `index.ts` sibling resolves with the `@swc-node/register` loader
 * for source-mode bootstrap.
 *
 * @param startDir - Directory to begin the ascent from. Defaults to the running module's directory; pass an explicit value to resolve from another anchor or under test.
 * @returns Worker invocation descriptor, or `undefined` if no worker is found under any ancestor.
 *
 * @example Locating the worker beside the builder
 * ```typescript
 * const invocation = resolveDefaultRollupWorkerPath()
 * if (!invocation) throw new Error('builder rollup worker artifact not found')
 * ```
 */
export const resolveDefaultRollupWorkerPath = (startDir?: string): RollupWorkerInvocation | undefined =>
  ascendForWorker(['bundle', 'rollup', 'worker'], startDir)

const createReportDir = (): string => mkdtempSync(join(tmpdir(), REPORT_DIR_PREFIX))

const reportPathFor = (reportDir: string, descriptor: RollupBuildDescriptor): string => {
  const safeLabel = descriptor.inputFile.replace(/[^a-zA-Z0-9_-]+/g, '_')
  return join(reportDir, `${descriptor.format}-${safeLabel}.json`)
}

const runOne = (descriptor: RollupBuildDescriptor, options: DispatchRollupWorkerOptions, label: string): Promise<void> =>
  createPromise<void>((resolve, reject) => {
    const execPath = options.execPath ?? process.execPath
    const argv = [...(options.execArgv ?? []), options.workerPath, stringify(descriptor)]
    const child = spawn(execPath, argv, { stdio: ['ignore', 'pipe', 'pipe'] })
    let capturedStderr = ''
    child.stdout?.on('data', (chunk: Buffer | string) => {
      process.stdout.write(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString()
      capturedStderr += text
      process.stderr.write(text)
    })
    child.on('error', (error) => {
      reject(createError(`rollup worker for ${label} failed to spawn: ${error.message}`))
    })
    child.on('exit', (code) => {
      if (code !== 0) {
        const tail = capturedStderr.trim().split('\n').slice(-10).join('\n')
        reject(createError(`rollup worker for ${label} exited with code ${code}\n${tail}`))
        return
      }
      resolve()
    })
  })

const readReport = (reportPath: string, label: string): RollupWorkerReport => {
  if (!existsSync(reportPath)) {
    throw createError(`rollup worker for ${label} did not write a report at ${reportPath}`)
  }
  const data = <RollupWorkerReport>parse(readFileSync(reportPath, 'utf8'))
  return data
}

/**
 * Forks a single rollup worker for the supplied descriptor and waits for it
 * to exit. The caller-provided descriptor's `reportPath` is overwritten with
 * a temp-dir path created by this function.
 *
 * Each worker writes a JSON report at the temp path; this function reads it
 * after the child exits and returns the per-job statistics. If the worker
 * exits non-zero or fails to produce a report, the function throws with a
 * label-rich message.
 *
 * The temp report directory is cleaned up before returning, regardless of
 * success or failure.
 *
 * @param descriptor - Build descriptor to dispatch.
 * @param options - Worker path + optional memory monitor.
 * @returns Worker report (output size + memory + duration) for the dispatched job.
 *
 * @example Dispatching a single ESM build
 * ```typescript
 * const report = await dispatchRollupWorker(descriptor, { workerPath: '/abs/dist/.../worker.cjs.js' })
 * ```
 */
export const dispatchRollupWorker = async (
  descriptor: RollupBuildDescriptor,
  options: DispatchRollupWorkerOptions
): Promise<RollupWorkerReport> => {
  const reportDir = createReportDir()
  const label = options.label ?? `${descriptor.format}:${descriptor.inputFile}`
  const reportPath = reportPathFor(reportDir, descriptor)
  const job: RollupBuildDescriptor = { ...descriptor, reportPath }
  try {
    options.monitor?.check(`bundle:rollup:dispatch:${label}:start`)
    log.info(`rollup dispatch: ${label}`)
    await runOne(job, options, label)
    const report = readReport(reportPath, label)
    log.debug(
      `rollup dispatch done: ${label} size=${report.outputSize}B heap=${report.endHeapMB.toFixed(1)}MB rss=${report.endRssMB.toFixed(1)}MB t=${report.durationMs}ms`
    )
    options.monitor?.check(`bundle:rollup:dispatch:${label}:end`)
    return report
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}
