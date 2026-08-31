/**
 * Forked-worker entry script that runs a single postject inject via
 * {@link runInjectWorkerJob}, isolating its ~138 MB buffer from the parent RSS.
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
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && (require as unknown as RequireWithMain).main === module) {
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
  const job = JSON.parse(raw) as InjectWorkerJob
  runInjectWorkerJob(job).then(
    () => process.exit(0),
    (error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
      process.stderr.write(`inject worker for ${job.outputBinary} failed: ${message}\n`)
      process.exit(1)
    }
  )
}
