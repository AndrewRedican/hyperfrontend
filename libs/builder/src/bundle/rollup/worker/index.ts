/**
 * Forked-worker entry script that runs a single per-entry rollup pass via
 * {@link runRollupWorkerJob}.
 *
 * @module @hyperfrontend/builder/bundle/rollup/worker
 */
/* eslint-disable workspace/no-unsafe-builtin-methods -- worker bootstraps before workspace packages are built */
/* istanbul ignore file -- @preserve self-execution Node script; logic lives in job-runner.ts */
import type { RollupBuildDescriptor } from './types'
import { runRollupWorkerJob } from './job-runner'

export type { RollupBuildDescriptor, RollupWorkerBin, RollupWorkerBundleOutput, RollupWorkerFormat, RollupWorkerReport } from './types'
export { runRollupWorkerJob } from './job-runner'

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
    process.stderr.write('rollup worker: missing job spec on argv\n')
    process.exit(2)
  }
  const job = <RollupBuildDescriptor>JSON.parse(raw)
  runRollupWorkerJob(job).then(
    () => process.exit(0),
    (error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
      process.stderr.write(`rollup worker for ${job.format}/${job.inputFile} failed: ${message}\n`)
      process.exit(1)
    }
  )
}
