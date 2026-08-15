import type { Server } from 'node:http'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Reads the listening port from a server, throwing if the address is unexpectedly absent.
 *
 * @param server - A server whose `listen` callback has fired.
 * @returns The bound port.
 *
 * @example Reading the bound port after listen
 * ```typescript
 * server.listen(0, () => console.log(addressPort(server)))
 * ```
 */
export function addressPort(server: Server): number {
  const address = server.address()
  /* istanbul ignore next -- @preserve a fired listen() callback always yields an AddressInfo for a numeric port */
  if (address === null || typeof address === 'string') {
    throw createError('Server failed to report a listening port.')
  }
  return address.port
}

/**
 * Starts a server listening on a port and resolves with the bound port.
 *
 * @param server - The server to start.
 * @param port - The requested port (`0` lets the OS choose, used in tests).
 * @param host - Optional interface to bind; every interface when omitted.
 * @returns A promise for the actually-bound port.
 *
 * @example Listening on an OS-assigned port
 * ```typescript
 * const port = await listen(server, 0)
 * ```
 */
export function listen(server: Server, port: number, host?: string): Promise<number> {
  return createPromise((resolve) => {
    if (host === undefined) {
      server.listen(port, () => resolve(addressPort(server)))
      return
    }
    server.listen(port, host, () => resolve(addressPort(server)))
  })
}

/**
 * Closes a server and resolves once it has stopped accepting connections.
 *
 * @param server - The server to close.
 * @returns A promise that resolves when the server is closed.
 *
 * @example Tearing a server down
 * ```typescript
 * await closeServer(server)
 * ```
 */
export function closeServer(server: Server): Promise<void> {
  return createPromise((resolve) => {
    server.close(() => resolve())
  })
}
