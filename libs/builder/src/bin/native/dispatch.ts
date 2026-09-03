import type { MemoryMonitor } from '../../memory/monitor'
import type { InjectWorkerJob, InjectWorkerReport } from './worker/types'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'

const log = logger.channel('builder:bin:native:dispatch')

/**
 * Caller-supplied options threaded through {@link dispatchInjectWorker}.
 */
export interface DispatchInjectWorkerOptions {
  /** Absolute path to the worker entry script. Required; see {@link resolveDefaultInjectWorkerPath}. */
  workerPath: string
  /** Optional memory monitor invoked before and after the spawned worker. */
  monitor?: MemoryMonitor
  /** Override `process.execPath` for the spawned worker (used by tests). */
  execPath?: string
  /** Extra arguments prepended to the worker invocation (e.g. `['--require', '@swc-node/register']`). */
  execArgv?: string[]
  /** Human-readable label for log lines and monitor checkpoints (e.g. `hf-build`). */
  label?: string
}

/**
 * Resolved worker invocation: absolute path + any extra Node args (e.g. `--require \@swc-node/register`
 * when the worker is loaded from TypeScript source during a bootstrap build).
 */
export interface InjectWorkerInvocation {
  /** Absolute path to the worker entry script. */
  path: string
  /** Extra args prepended to the spawned child's argv. */
  execArgv: string[]
}

const REPORT_DIR_PREFIX = 'hf-builder-inject-'
const SWC_NODE_REGISTER = '@swc-node/register'

const swcNodeAvailable = (workspaceRoot: string): boolean =>
  existsSync(join(workspaceRoot, 'node_modules', '@swc-node', 'register', 'index.js'))

/**
 * Default worker-path resolution: prefers the built-and-published artifact, falls
 * back to the workspace dist path, and finally to the in-source TypeScript file
 * via `@swc-node/register` (bootstrap case where builder is building itself for
 * the first time and the dist worker doesn't exist yet).
 *
 * Looks at, in order:
 * 1. `<workspaceRoot>/dist/libs/builder/bin/native/worker/index.cjs.js`
 * 2. `<workspaceRoot>/node_modules/@hyperfrontend/builder/bin/native/worker/index.cjs.js`
 * 3. `<workspaceRoot>/libs/builder/src/bin/native/worker/index.ts` (with `--require \@swc-node/register`)
 *
 * @param workspaceRoot - Absolute workspace root.
 * @returns Worker invocation descriptor, or `undefined` if no candidate exists.
 *
 * @example Locating the worker for an in-workspace consumer
 * ```typescript
 * const invocation = resolveDefaultInjectWorkerPath('/abs/repo')
 * if (!invocation) throw new Error('builder inject worker artifact not found')
 * ```
 */
export const resolveDefaultInjectWorkerPath = (workspaceRoot: string): InjectWorkerInvocation | undefined => {
  const distCandidates = [
    join(workspaceRoot, 'dist', 'libs', 'builder', 'bin', 'native', 'worker', 'index.cjs.js'),
    join(workspaceRoot, 'node_modules', '@hyperfrontend', 'builder', 'bin', 'native', 'worker', 'index.cjs.js'),
  ]
  for (const path of distCandidates) {
    if (existsSync(path)) return { path, execArgv: [] }
  }
  const sourcePath = join(workspaceRoot, 'libs', 'builder', 'src', 'bin', 'native', 'worker', 'index.ts')
  if (existsSync(sourcePath) && swcNodeAvailable(workspaceRoot)) {
    return { path: sourcePath, execArgv: ['--require', SWC_NODE_REGISTER] }
  }
  return undefined
}

const createReportDir = (): string => mkdtempSync(join(tmpdir(), REPORT_DIR_PREFIX))

const reportPathFor = (reportDir: string, job: InjectWorkerJob): string => {
  const safeLabel = job.outputBinary.replace(/[^a-zA-Z0-9_-]+/g, '_')
  return join(reportDir, `inject-${safeLabel}.json`)
}

const runOne = (job: InjectWorkerJob, options: DispatchInjectWorkerOptions, label: string): Promise<void> =>
  createPromise<void>((resolve, reject) => {
    const execPath = options.execPath ?? process.execPath
    const argv = [...(options.execArgv ?? []), options.workerPath, stringify(job)]
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
      reject(createError(`inject worker for ${label} failed to spawn: ${error.message}`))
    })
    child.on('exit', (code) => {
      if (code !== 0) {
        const tail = capturedStderr.trim().split('\n').slice(-10).join('\n')
        reject(createError(`inject worker for ${label} exited with code ${code}\n${tail}`))
        return
      }
      resolve()
    })
  })

const readReport = (reportPath: string, label: string): InjectWorkerReport => {
  if (!existsSync(reportPath)) {
    throw createError(`inject worker for ${label} did not write a report at ${reportPath}`)
  }
  const data = parse(readFileSync(reportPath, 'utf8')) as InjectWorkerReport
  return data
}

/**
 * Forks a single inject worker for the supplied job and waits for it to exit.
 * The caller-provided job's `reportPath` is overwritten with a temp-dir path
 * created by this function.
 *
 * The worker writes a JSON report at the temp path; this function reads it
 * after the child exits and returns the per-job statistics. If the worker
 * exits non-zero or fails to produce a report, the function throws with a
 * label-rich message.
 *
 * The temp report directory is cleaned up before returning, regardless of
 * success or failure.
 *
 * @param job - Inject job to dispatch.
 * @param options - Worker path + optional memory monitor.
 * @returns Worker report (output size + memory + duration) for the dispatched job.
 *
 * @example Dispatching a SEA inject for hf-build
 * ```typescript
 * const report = await dispatchInjectWorker(
 *   { hostBinary, outputBinary, blobPath, resourceName, machoSegmentName, sentinelFuse, reportPath: '' },
 *   { workerPath: '/abs/dist/.../worker.cjs.js', label: 'hf-build' }
 * )
 * ```
 */
export const dispatchInjectWorker = async (job: InjectWorkerJob, options: DispatchInjectWorkerOptions): Promise<InjectWorkerReport> => {
  const reportDir = createReportDir()
  const label = options.label ?? job.outputBinary
  const reportPath = reportPathFor(reportDir, job)
  const dispatched: InjectWorkerJob = { ...job, reportPath }
  try {
    options.monitor?.check(`bin:native:dispatch:${label}:start`)
    log.info(`inject dispatch: ${label}`)
    await runOne(dispatched, options, label)
    const report = readReport(reportPath, label)
    log.debug(
      `inject dispatch done: ${label} size=${report.outputSize}B heap=${report.endHeapMB.toFixed(1)}MB rss=${report.endRssMB.toFixed(1)}MB t=${report.durationMs}ms`
    )
    options.monitor?.check(`bin:native:dispatch:${label}:end`)
    return report
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}
