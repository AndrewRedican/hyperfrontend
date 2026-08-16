/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
import type { InjectWorkerJob, InjectWorkerReport } from './types'
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { inject } from 'postject'

const BYTES_PER_MB = 1024 * 1024

const ensureDir = (path: string): void => {
  mkdirSync(path, { recursive: true })
}

const safeStatSize = (filePath: string): number => {
  /* istanbul ignore next -- @preserve defensive: postject always produces the declared output file */
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

/**
 * Runs the postject inject for `job` in the current process and writes the
 * resulting report to `job.reportPath`.
 *
 * Call this to drive the worker logic without spawning a new Node process. The
 * inject normally runs in a forked child because `postject.inject` loads the
 * entire ~121 MB host binary into a Node `Buffer` and rewrites it with the
 * embedded blob: a single ~138 MB allocation that needs to be reclaimed on
 * process exit rather than retained in the parent's RSS.
 *
 * @param job - Descriptor describing the inject invocation.
 * @returns The on-disk report data the worker would have persisted.
 *
 * @example Driving the worker logic in-process for a fixture
 * ```typescript
 * const report = await runInjectWorkerJob({
 *   hostBinary: '/opt/node',
 *   outputBinary: '/tmp/out',
 *   blobPath: '/tmp/sea.blob',
 *   resourceName: 'NODE_SEA_BLOB',
 *   machoSegmentName: 'NODE_SEA',
 *   sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
 *   reportPath: '/tmp/report.json',
 * })
 * ```
 */
export const runInjectWorkerJob = async (job: InjectWorkerJob): Promise<InjectWorkerReport> => {
  const startedAt = Date.now()
  ensureDir(dirname(job.outputBinary))
  ensureDir(dirname(job.reportPath))
  copyFileSync(job.hostBinary, job.outputBinary)
  const blob = readFileSync(job.blobPath)
  await inject(job.outputBinary, job.resourceName, blob, {
    machoSegmentName: job.machoSegmentName,
    sentinelFuse: job.sentinelFuse,
  })
  const memory = process.memoryUsage()
  const report: InjectWorkerReport = {
    outputSize: safeStatSize(job.outputBinary),
    endHeapMB: memory.heapUsed / BYTES_PER_MB,
    endRssMB: memory.rss / BYTES_PER_MB,
    durationMs: Date.now() - startedAt,
  }
  writeFileSync(job.reportPath, JSON.stringify(report))
  return report
}
