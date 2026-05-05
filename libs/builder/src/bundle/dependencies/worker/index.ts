/**
 * Forked-worker entry script for dependency pre-pass invocations.
 *
 * Reads a {@link PrePassWorkerJob} from `process.argv[2]`, runs a single
 * rollup pass through {@link runPrePassWorkerJob}, and exits with code 0 on
 * success or 1 on failure.
 *
 * @module @hyperfrontend/builder/bundle/dependencies/worker
 */
/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
/* istanbul ignore file -- @preserve self-execution Node script; logic lives in job-runner.ts */
import type { PrePassWorkerJob } from './job-runner'
import { runPrePassWorkerJob } from './job-runner'

export type { PrePassWorkerJob, PrePassWorkerReport } from './job-runner'
export { runPrePassWorkerJob } from './job-runner'

/**
 * Narrow type guard for accessing `require.main` without using a `require as unknown` cast.
 */
interface RequireWithMain {
  /** Module that started this Node process when running under CJS. */
  main?: unknown
}

const isMainModule = (): boolean => {
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && (<RequireWithMain>(<unknown>require)).main === module) {
    return true
  }
  const argv1 = process.argv[1] ?? ''
  return argv1.endsWith('index.cjs.js') || argv1.endsWith('index.esm.js') || argv1.endsWith('index.ts') || argv1.endsWith('index.js')
}

if (isMainModule()) {
  const raw = process.argv[2]
  if (!raw) {
    process.stderr.write('pre-pass worker: missing job spec on argv\n')
    process.exit(2)
  }
  const job = <PrePassWorkerJob>JSON.parse(raw)
  runPrePassWorkerJob(job).then(
    () => process.exit(0),
    (error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
      process.stderr.write(`pre-pass worker for ${job.dep}/${job.kind}/${job.format} failed: ${message}\n`)
      process.exit(1)
    }
  )
}
