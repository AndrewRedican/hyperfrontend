import type { MemoryMonitor } from '../../memory/monitor'
import type { WorkerInvocation } from '../worker-locator'
import type { WorkspaceBundledDepRoute } from './externalize-plugin'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'
import { ascendForWorker } from '../worker-locator'

const log = logger.channel('builder:bundle:dependencies:pre-pass')

/**
 * Pre-pass kind. Mirrors `PrePassWorkerJobKind` on the worker side.
 */
export type PrePassJobKind = 'js' | 'dts' | 'workspace-js' | 'workspace-dts'

/**
 * Single-rollup-invocation job description fed to a forked worker.
 */
export interface PrePassJob {
  /**
   * Pre-pass kind. `js` and `dts` cover npm bundled deps; `workspace-js` and
   * `workspace-dts` cover workspace `@hyperfrontend/*` deps whose entries are
   * TypeScript source.
   */
  kind: PrePassJobKind
  /** Dep package name (or workspace specifier), e.g. `"rollup"` or `"@hyperfrontend/logging"`. */
  dep: string
  /** Absolute path to the dep's input entry. */
  inputPath: string
  /** Format produced by this rollup invocation. */
  format: 'esm' | 'cjs'
  /** Absolute path to the worker's output file. */
  outputPath: string
  /** Other deps in the pre-pass set; prefix-matched and marked external so cross-dep imports stay link-time. */
  otherDeps: string[]
  /**
   * Sub-path-mode workspace specifiers in the pre-pass set; matched as exact
   * specifier only. Used by `workspace-*` jobs so sibling sub-paths externalize
   * cleanly (e.g., one `built-in-copy/<x>` chunk does not pull in another).
   */
  otherWorkspaceSpecifiers?: string[]
  /** Absolute path to the project's tsconfig (workspace-* jobs only). */
  tsConfigPath?: string
  /** Absolute workspace root used as `baseUrl` for path-mapping resolution (workspace-* jobs only). */
  workspaceRoot?: string
  /**
   * Sibling-entry descriptors used by the per-entry `dts` pass to externalize
   * imports that resolve into another entry's directory. See {@link
   * SiblingEntryDescriptor}. Empty / omitted for dep pre-pass jobs.
   */
  siblingEntries?: SiblingEntryDescriptor[]
  /** Absolute path to the input file's owning entry directory (used to compute sibling specifiers). */
  selfDtsPath?: string
  /** Owning entry's `srcPath`. Empty string for the package root. */
  selfSrcPath?: string
  /**
   * NPM bundled-dep names consumed by the worker's externalize plugin to rewrite
   * cross-dep imports to relative paths under {@link depsRoot}. Disjoint from
   * {@link workspaceRoutes}.
   */
  npmDeps?: string[]
  /**
   * Workspace bundled-dep routes consumed by the worker's externalize plugin.
   * For self-pre-pass jobs (`workspace-js` / `workspace-dts`) this excludes the
   * specifier or package being built so the chunk inlines its own internals.
   */
  workspaceRoutes?: WorkspaceBundledDepRoute[]
  /** Absolute path to the project's `_dependencies/` root. Required when {@link npmDeps} or {@link workspaceRoutes} is non-empty. */
  depsRoot?: string
}

/**
 * Sibling-entry descriptor threaded through to the worker for the per-entry
 * d.ts pass.
 */
export interface SiblingEntryDescriptor {
  /** Sibling entry's `srcPath` (subpath under `<outputPath>`). `''` for the package root. */
  srcPath: string
  /** Absolute path to the sibling's bundled `index.d.ts`. */
  indexDtsPath: string
}

/**
 * Result emitted by the worker for a single job.
 */
export interface PrePassResult {
  /** The job that produced this result. */
  job: PrePassJob
  /** Output file size in bytes. */
  outputSize: number
  /** Heap reported by the child at exit, in MB. */
  endHeapMB: number
  /** RSS reported by the child at exit, in MB. */
  endRssMB: number
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
  join(reportDir, `${index}-${job.dep.replace(/\//g, '__')}-${job.kind}-${job.format}.json`)

const runOne = (job: PrePassJob, reportPath: string, options: RunPrePassOptions): Promise<void> =>
  createPromise<void>((resolve, reject) => {
    const execPath = options.execPath ?? process.execPath
    const argv = [...(options.execArgv ?? []), options.workerPath, stringify({ ...job, reportPath })]
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

/**
 * On-disk shape of the JSON report each pre-pass worker writes before exiting.
 *
 * Mirrors the `PrePassWorkerReport` produced by `bundle/dependencies/worker/job-runner.ts`,
 * duplicated here so the parent can consume reports without importing worker-side types
 * across the process boundary.
 */
interface PrePassReportFile {
  /** Final on-disk size of the rollup output, in bytes. */
  outputSize: number
  /** `process.memoryUsage().heapUsed` reported by the child at exit, in MB. */
  endHeapMB: number
  /** `process.memoryUsage().rss` reported by the child at exit, in MB. */
  endRssMB: number
  /** Worker wall-clock duration, in ms. */
  durationMs: number
}

const readReport = (reportPath: string, job: PrePassJob): PrePassResult => {
  if (!existsSync(reportPath)) {
    throw createError(`pre-pass worker for ${job.dep} (${job.kind}/${job.format}) did not write a report at ${reportPath}`)
  }
  const data = <PrePassReportFile>parse(readFileSync(reportPath, 'utf8'))
  return { job, outputSize: data.outputSize, endHeapMB: data.endHeapMB, endRssMB: data.endRssMB, durationMs: data.durationMs }
}

/**
 * Resolves the dependency pre-pass worker by self-locating it beside the running
 * builder module: ascends from the module's own directory to the builder package
 * root and returns the worker at `bundle/dependencies/worker`. This works whether
 * the builder runs from its built dist, an installed `node_modules` copy, or
 * melded into a host bundle under `_dependencies/`. The compiled `index.cjs.js`
 * is preferred; an `index.ts` sibling resolves with the `@swc-node/register`
 * loader for source-mode bootstrap.
 *
 * @param startDir - Directory to begin the ascent from. Defaults to the running module's directory; pass an explicit value to resolve from another anchor or under test.
 * @returns Worker invocation descriptor, or `undefined` if no worker is found under any ancestor.
 *
 * @example Locating the worker beside the builder
 * ```typescript
 * const invocation = resolveDefaultWorkerPath()
 * if (!invocation) throw new Error('builder worker artifact not found')
 * ```
 */
export const resolveDefaultWorkerPath = (startDir?: string): WorkerInvocation | undefined =>
  ascendForWorker(['bundle', 'dependencies', 'worker'], startDir)

/**
 * Sequentially runs the supplied pre-pass jobs by forking a fresh Node child
 * per invocation. Strict sequential execution is mandatory — concurrent
 * children would simultaneously pressure RAM and OOM the container.
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
        `pre-pass ${index + 1}/${jobs.length} done: ${job.dep} size=${result.outputSize}B heap=${result.endHeapMB.toFixed(1)}MB rss=${result.endRssMB.toFixed(1)}MB t=${result.durationMs}ms`
      )
      options.monitor?.check(`bundle:dependencies:prepass:${index + 1}/${jobs.length}:${job.dep}:${job.kind}:${job.format}:end`)
      results.push(result)
    }
    return results
  } finally {
    rmSync(reportDir, { recursive: true, force: true })
  }
}
