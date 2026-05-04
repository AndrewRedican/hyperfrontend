import type { MemoryMonitor } from '../../memory/monitor'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'

const log = logger.channel('builder:bundle:dependencies:pre-pass')

/**
 * Single-rollup-invocation job description fed to a forked worker.
 */
export interface PrePassJob {
  /** Pre-pass kind: `'js'` for JS rollup, `'dts'` for `rollup-plugin-dts`. */
  kind: 'js' | 'dts'
  /** Dep package name, e.g. `"rollup"` or `"@rollup/plugin-typescript"`. */
  dep: string
  /** Absolute path to the dep's input entry. */
  inputPath: string
  /** Format produced by this rollup invocation. */
  format: 'esm' | 'cjs'
  /** Absolute path to the worker's output file. */
  outputPath: string
  /** Other deps in the pre-pass set; marked external so cross-dep imports stay link-time. */
  otherDeps: string[]
}

/**
 * Result emitted by the worker for a single job.
 */
export interface PrePassResult {
  /** The job that produced this result. */
  job: PrePassJob
  /** Output file size in bytes. */
  outputSize: number
  /** Peak heap reported by the child at exit, in MB. */
  peakHeapMB: number
  /** Peak RSS reported by the child at exit, in MB. */
  peakRssMB: number
  /** Wall-clock duration the worker reported, in ms. */
  durationMs: number
}

/**
 * Caller-supplied options threaded through {@link runPrePass}.
 */
export interface RunPrePassOptions {
  /** Absolute path to the worker entry script. Required — see `resolveDefaultWorkerPath`. */
  workerPath: string
  /** Optional memory monitor invoked between every spawned worker. */
  monitor?: MemoryMonitor
  /** Override `process.execPath` for the spawned worker (used by tests). */
  execPath?: string
  /** Extra arguments prepended to the worker invocation (e.g. `['--require', '@swc-node/register']`). */
  execArgv?: string[]
}

const REPORT_DIR_PREFIX = 'hf-builder-prepass-'

const createReportDir = (): string => mkdtempSync(join(tmpdir(), REPORT_DIR_PREFIX))

const reportPathFor = (reportDir: string, job: PrePassJob, index: number): string =>
  join(reportDir, `${index}-${job.dep.replace(/[\/]/g, '__')}-${job.kind}-${job.format}.json`)

const runOne = (job: PrePassJob, reportPath: string, options: RunPrePassOptions): Promise<void> =>
  createPromise<void>((resolve, reject) => {
    const execPath = options.execPath ?? process.execPath
    const argv = [...(options.execArgv ?? []), options.workerPath, JSON.stringify({ ...job, reportPath })]
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
      reject(createError(`pre-pass worker for ${job.dep} (${job.kind}/${job.format}) failed to spawn: ${error.message}`))
    })
    child.on('exit', (code) => {
      if (code !== 0) {
        const tail = capturedStderr.trim().split('\n').slice(-10).join('\n')
        reject(createError(`pre-pass worker for ${job.dep} (${job.kind}/${job.format}) exited with code ${code}\n${tail}`))
        return
      }
      resolve()
    })
  })

const readReport = (reportPath: string, job: PrePassJob): PrePassResult => {
  if (!existsSync(reportPath)) {
    throw createError(`pre-pass worker for ${job.dep} (${job.kind}/${job.format}) did not write a report at ${reportPath}`)
  }
  const data = <{ outputSize: number; peakHeapMB: number; peakRssMB: number; durationMs: number }>(
    JSON.parse(readFileSync(reportPath, 'utf8'))
  )
  return { job, outputSize: data.outputSize, peakHeapMB: data.peakHeapMB, peakRssMB: data.peakRssMB, durationMs: data.durationMs }
}

/**
 * Resolved worker invocation: absolute path + any extra Node args (e.g. `--require @swc-node/register`
 * when the worker is loaded from TypeScript source during a bootstrap build).
 */
export interface WorkerInvocation {
  /** Absolute path to the worker entry script. */
  path: string
  /** Extra args prepended to the spawned child's argv. */
  execArgv: string[]
}

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
 * 1. `<workspaceRoot>/dist/libs/builder/bundle/dependencies/worker/index.cjs.js`
 * 2. `<workspaceRoot>/node_modules/@hyperfrontend/builder/bundle/dependencies/worker/index.cjs.js`
 * 3. `<workspaceRoot>/libs/builder/src/bundle/dependencies/worker/index.ts` (with `--require @swc-node/register`)
 *
 * @param workspaceRoot - Absolute workspace root.
 * @returns Worker invocation descriptor, or `undefined` if no candidate exists.
 *
 * @example Locating the worker for an in-workspace consumer
 * ```typescript
 * const invocation = resolveDefaultWorkerPath('/abs/repo')
 * if (!invocation) throw new Error('builder worker artifact not found')
 * ```
 */
export const resolveDefaultWorkerPath = (workspaceRoot: string): WorkerInvocation | undefined => {
  const distCandidates = [
    join(workspaceRoot, 'dist', 'libs', 'builder', 'bundle', 'dependencies', 'worker', 'index.cjs.js'),
    join(workspaceRoot, 'node_modules', '@hyperfrontend', 'builder', 'bundle', 'dependencies', 'worker', 'index.cjs.js'),
  ]
  for (const path of distCandidates) {
    if (existsSync(path)) return { path, execArgv: [] }
  }
  const sourcePath = join(workspaceRoot, 'libs', 'builder', 'src', 'bundle', 'dependencies', 'worker', 'index.ts')
  if (existsSync(sourcePath) && swcNodeAvailable(workspaceRoot)) {
    return { path: sourcePath, execArgv: ['--require', SWC_NODE_REGISTER] }
  }
  return undefined
}

/**
 * Sequentially runs the supplied pre-pass jobs by forking a fresh Node child
 * per invocation. Strict sequential execution is mandatory — concurrent
 * children would simultaneously pressure RAM and OOM the container (Decision
 * #39, [overview G3]).
 *
 * Each child writes a JSON report to a parent-supplied path; this function
 * reads the report after the child exits and accumulates per-job statistics.
 * If any worker exits non-zero or fails to produce a report, the function
 * throws with the failed job's context.
 *
 * The report directory is created in the OS temp dir and removed before
 * returning, regardless of success or failure.
 *
 * @param jobs - Pre-pass jobs to run.
 * @param options - Worker path + optional memory monitor.
 * @returns One result per supplied job, in the order the jobs were given.
 *
 * @example Pre-passing rollup and one of its plugins
 * ```typescript
 * const results = await runPrePass(jobs, { workerPath: '/abs/dist/libs/builder/bundle/dependencies/worker.cjs.js' })
 * ```
 */
export const runPrePass = async (jobs: PrePassJob[], options: RunPrePassOptions): Promise<PrePassResult[]> => {
  if (jobs.length === 0) return []
  const reportDir = createReportDir()
  const results: PrePassResult[] = []
  try {
    for (const [index, job] of jobs.entries()) {
      const reportPath = reportPathFor(reportDir, job, index)
      log.info(`pre-pass ${index + 1}/${jobs.length}: ${job.dep} (${job.kind}/${job.format})`)
      options.monitor?.check(`bundle:dependencies:prepass:${index + 1}/${jobs.length}:${job.dep}:${job.kind}:${job.format}:start`)
      await runOne(job, reportPath, options)
      const result = readReport(reportPath, job)
      log.debug(
        `pre-pass ${index + 1}/${jobs.length} done: ${job.dep} size=${result.outputSize}B heap=${result.peakHeapMB.toFixed(1)}MB rss=${result.peakRssMB.toFixed(1)}MB t=${result.durationMs}ms`
      )
      options.monitor?.check(`bundle:dependencies:prepass:${index + 1}/${jobs.length}:${job.dep}:${job.kind}:${job.format}:end`)
      results.push(result)
    }
    return results
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}
