import type { Socket } from 'node:net'
import type { ServiceClock } from './clock'
import type { ServiceEvent } from './events'
import type { Exchange } from './exchange'
import { STATUS_CODES } from 'node:http'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-set'
import { emitEvent, errorName } from './events'

/** What the registry reads from an exchange in flight, and what it settles on one. */
type TrackedExchange = Pick<Exchange, 'status' | 'settleOutcome' | 'noteStatus' | 'onEnd'>

/** The sockets of one service and the exchanges in flight on each of them. */
export interface Connections {
  /**
   * Tracks a socket from Node's `connection` event to its close.
   *
   * @param socket - The socket of a connection the server just accepted.
   */
  connection(socket: Socket): void
  /**
   * Counts an exchange as in flight on its connection until the exchange ends. While draining, the end of the last
   * exchange on a connection closes that connection.
   *
   * @param socket - The socket of the exchange's request.
   * @param exchange - The exchange that just started.
   */
  enter(socket: Socket, exchange: TrackedExchange): void
  /**
   * Handles what Node reports through `clientError`. A malformed request, a header overflow and a request timeout are
   * reported once per connection and answered with a bare status when the socket can still carry one; a client that left is neither.
   * Every exchange on the connection without an outcome gets one, and the socket is destroyed either way, right after the answer when there is one.
   *
   * @param error - The error as Node hands it over; it is classified by its `code`.
   * @param socket - The socket the error belongs to.
   */
  clientError(error: Error, socket: Socket): void
  /**
   * Reports whether the service is shutting down.
   *
   * @returns `true` once `drain` has been called.
   */
  draining(): boolean
  /**
   * Reports whether the head of an exchange must close its connection for the shutdown: the service is draining and no
   * later exchange is in flight on the connection, so a pipelined request already in flight is still answered.
   *
   * @param socket - The socket of the exchange's request.
   * @param exchange - The exchange whose head is about to be written.
   * @returns `true` while draining for the exchange entered last on its connection, and for one on a connection with none in flight.
   */
  closing(socket: Socket, exchange: TrackedExchange): boolean
  /**
   * Shuts the connections down: idle ones are destroyed at once, busy ones are closed when their last exchange ends,
   * and when the grace runs out every exchange still in flight is cut as `shutdown` and every socket destroyed.
   *
   * @param graceMs - How long exchanges in flight may run on, in milliseconds on the injected clock.
   * @returns A promise that resolves when every tracked socket has closed; at once when none is open. It never rejects.
   */
  drain(graceMs: number): Promise<void>
}

/** A fault of the protocol on a connection: what the client is answered and what the sink is told. */
interface ProtocolFault {
  /** The status of the bare answer. */
  readonly status: number
  /** The code of the failure event. */
  readonly code: string
}

const HEADER_OVERFLOW: ProtocolFault = freeze({ status: 431, code: 'header-overflow' })
const REQUEST_TIMEOUT: ProtocolFault = freeze({ status: 408, code: 'request-timeout' })
const MALFORMED_REQUEST: ProtocolFault = freeze({ status: 400, code: 'malformed-request' })

/**
 * Classifies an error of a connection by its code.
 *
 * @param error - The error Node reported.
 * @returns The fault of the protocol it stands for, or `null` for a client that left or a plain socket error.
 */
function protocolFault(error: Error): ProtocolFault | null {
  const code: unknown = (error as NodeJS.ErrnoException).code
  if (code === 'HPE_HEADER_OVERFLOW') {
    return HEADER_OVERFLOW
  }
  if (code === 'ERR_HTTP_REQUEST_TIMEOUT') {
    return REQUEST_TIMEOUT
  }
  // note: the parser reports a client that closed in the middle of a message under a code of its own, and that is a departure, not a malformed request
  return typeof code === 'string' && code.startsWith('HPE_') && code !== 'HPE_INVALID_EOF_STATE' ? MALFORMED_REQUEST : null
}

/**
 * Builds the registry of a service's connections: which sockets are open, which exchanges are in flight on each,
 * what a client error does to them, and how they are shut down.
 *
 * @param clock - The clock the shutdown grace is timed on.
 * @param emit - Where the failure event of a protocol error goes. It is called through a guard, so a sink that throws or rejects is ignored.
 * @returns The registry, frozen. Its `drain` is called once.
 *
 * @example Wiring a server's connection events and draining it
 * ```typescript
 * const connections = createConnections(systemClock, (event) => emitEvent(deps.report, event))
 * server.on('connection', connections.connection)
 * server.on('clientError', connections.clientError)
 * server.on('request', (req, res) => {
 *   const exchange = createExchange(req, res, options, systemClock, deps.report, false)
 *   connections.enter(exchange.socket, exchange)
 * })
 * server.close()
 * await connections.drain(10000) // resolves when every socket has closed, at the latest soon after ten seconds
 * ```
 */
export function createConnections(clock: ServiceClock, emit: (event: ServiceEvent) => void): Connections {
  const sockets = createSet<Socket>()
  const busy = createMap<Socket, Set<TrackedExchange>>()
  const faulted = createWeakSet<Socket>()
  let isDraining = false
  let finishDrain: (() => void) | null = null

  const checkDrained = (): void => {
    if (sockets.size === 0 && finishDrain !== null) {
      finishDrain()
    }
  }

  const cutAtGrace = (): void => {
    busy.forEach((exchanges) => {
      exchanges.forEach((exchange) => void exchange.settleOutcome('shutdown'))
    })
    sockets.forEach((socket) => void socket.destroy())
  }

  return freeze({
    connection: (socket: Socket): void => {
      // why: every exchange in flight listens for its socket's close, and a client may pipeline more requests than the default ceiling of listeners
      socket.setMaxListeners(0)
      sockets.add(socket)
      socket.once('close', () => {
        sockets.delete(socket)
        checkDrained()
      })
    },
    enter: (socket: Socket, exchange: TrackedExchange): void => {
      const exchanges = busy.get(socket) ?? createSet<TrackedExchange>()
      busy.set(socket, exchanges)
      exchanges.add(exchange)
      exchange.onEnd(() => {
        exchanges.delete(exchange)
        if (exchanges.size > 0) {
          return
        }
        busy.delete(socket)
        // why: a head written before the drain began promised to keep the connection, so nothing else would close it
        if (isDraining && !socket.destroyed) {
          socket.destroySoon()
        }
      })
    },
    clientError: (error: Error, socket: Socket): void => {
      const exchanges = [...(busy.get(socket) ?? [])]
      const fault = protocolFault(error)
      // why: a request timeout on a connection that never sent a byte is a preconnect or a health check, not a request
      if (fault === null || (fault === REQUEST_TIMEOUT && exchanges.length === 0 && socket.bytesRead === 0)) {
        exchanges.forEach((exchange) => void exchange.settleOutcome('client-closed'))
        socket.destroy()
        return
      }
      // why: a parser fed more of what it already refused reports the same connection again, and one connection is one failure
      if (faulted.has(socket)) {
        socket.destroy()
        return
      }
      faulted.add(socket)
      emitEvent(emit, freeze({ type: 'failure', code: fault.code, name: errorName(error), method: null, route: null, path: null }))
      // why: a bare answer after a head would land inside that response, so a connection that carries one is cut instead
      const answered = socket.writable && exchanges.every((exchange) => exchange.status === 0)
      const outcome = fault === REQUEST_TIMEOUT ? 'request-timeout' : 'client-closed'
      exchanges.forEach((exchange) => {
        if (exchange.settleOutcome(outcome) && answered) {
          exchange.noteStatus(fault.status)
        }
      })
      if (!answered) {
        socket.destroy()
        return
      }
      socket.write(`HTTP/1.1 ${fault.status} ${STATUS_CODES[fault.status] as string}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
      // why: a socket left open to flush keeps feeding the parser what the client sent next, and Node warns about a second error on it
      socket.destroy()
    },
    draining: (): boolean => isDraining,
    closing: (socket: Socket, exchange: TrackedExchange): boolean => {
      const exchanges = [...(busy.get(socket) ?? [exchange])]
      return isDraining && exchanges[exchanges.length - 1] === exchange
    },
    drain: (graceMs: number): Promise<void> => {
      isDraining = true
      sockets.forEach((socket) => {
        if (!busy.has(socket)) {
          socket.destroy()
        }
      })
      return createPromise<void>((resolve) => {
        const timer = clock.setTimeout(cutAtGrace, graceMs)
        finishDrain = () => {
          clock.clearTimeout(timer)
          resolve()
        }
        checkDrained()
      })
    },
  })
}
