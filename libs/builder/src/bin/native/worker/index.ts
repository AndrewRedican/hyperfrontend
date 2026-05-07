/**
 * Forked-worker entry script for postject inject.
 *
 * Reads an {@link InjectWorkerJob} from `process.argv[2]`, runs a single
 * inject pass through {@link runInjectWorkerJob}, and exits with code 0 on
 * success or 1 on failure. The worker exists so the ~138 MB postject buffer
 * load is reclaimed at child exit and never enters the parent's RSS.
 *
 * @module @hyperfrontend/builder/bin/native/worker
 */
/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
/* istanbul ignore file -- @preserve self-execution Node script; logic lives in job-runner.ts */
import type { InjectWorkerJob } from './types'
import { runInjectWorkerJob } from './job-runner'

export type { InjectWorkerJob, InjectWorkerReport } from './types'
export { runInjectWorkerJob } from './job-runner'

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
    process.stderr.write('inject worker: missing job spec on argv\n')
    process.exit(2)
  }
  const job = <InjectWorkerJob>JSON.parse(raw)
  runInjectWorkerJob(job).then(
    () => process.exit(0),
    (error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
      process.stderr.write(`inject worker for ${job.outputBinary} failed: ${message}\n`)
      process.exit(1)
    }
  )
}
