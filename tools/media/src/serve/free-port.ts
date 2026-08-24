import type { AddressInfo } from 'node:net'
import { createServer } from 'node:net'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Ask the operating system for a port nothing is listening on.
 *
 * Scenes never name a port. A recording run frequently shares a machine with
 * whatever development server was already running, and a hardcoded port turns
 * that into an error that looks like a broken scene.
 *
 * @returns A port that was free a moment ago.
 */
export function findFreePort(): Promise<number> {
  return createPromise<number>((resolve, reject) => {
    const probe = createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const port = (<AddressInfo>probe.address()).port
      probe.close(() => {
        resolve(port)
      })
    })
  })
}
