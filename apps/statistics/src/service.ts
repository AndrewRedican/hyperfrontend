import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { defineStatistics } from './statistics'

/** The service as the runner runs it: the definition, given the process's own transport, clock and standard streams. */
export const service = defineStatistics({
  fetch: (url, init) => fetch(url, init),
  now: dateNow,
  write: (line) => {
    process.stdout.write(line)
  },
  writeError: (line) => {
    process.stderr.write(line)
  },
})
