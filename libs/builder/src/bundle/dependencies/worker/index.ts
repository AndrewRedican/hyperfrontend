/* istanbul ignore file -- @preserve self-execution Node script; logic lives in job-runner.ts */
import type { PrePassWorkerJob } from './job-runner'
import { runPrePassWorkerJob } from './job-runner'

export type { PrePassWorkerJob, PrePassWorkerReport } from './job-runner'
export { runPrePassWorkerJob } from './job-runner'

const isMainModule = (): boolean => {
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && (require as unknown as { main?: unknown }).main === module)
    return true
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
