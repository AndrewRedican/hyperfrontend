import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import type { ServiceEvent } from './events'
import type { Exchange } from './exchange'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createConnections } from './connections'
import { createExchange } from './exchange'

/** One timer of the fake clock. */
interface Timer {
  /** What the timer runs when a spec fires it. */
  readonly callback: () => void
  /** The delay it was started with. */
  readonly ms: number
  /** Whether it was cancelled. */
  cleared: boolean
}

/** A fake socket: it records what is done to it, and closes only when a spec says so. */
interface FakeSocket extends EventEmitter {
  /** Whether the socket can still be written to. */
  writable: boolean
  /** How many bytes the client has sent. */
  bytesRead: number
  /** Whether the socket was destroyed. */
  destroyed: boolean
  /** What was done to the socket, in order: `write`, `destroy` and `destroySoon`. */
  readonly log: string[]
  /** Every text written to the socket. */
  readonly written: string[]
}

/** A registry over a fake clock and a recording sink. */
interface Harness {
  /** The registry under test. */
  readonly connections: ReturnType<typeof createConnections>
  /** Every event the sink received. */
  readonly events: ServiceEvent[]
  /** Every timer the registry started. */
  readonly timers: Timer[]
  /** Opens a fake socket and announces it to the registry. */
  open(): FakeSocket
  /** Starts an exchange on a socket and enters it in the registry. */
  enter(socket: FakeSocket): Exchange
}

/**
 * Builds a fake socket.
 *
 * @returns A writable socket that has received nothing.
 */
const fakeSocket = (): FakeSocket => {
  const log: string[] = []
  const written: string[] = []
  const socket: FakeSocket = Object.assign(new EventEmitter(), {
    remoteAddress: '192.0.2.7',
    writable: true,
    bytesRead: 0,
    destroyed: false,
    log,
    written,
    write: (text: string) => {
      log.push('write')
      written.push(text)
      return true
    },
    destroy: () => {
      log.push('destroy')
      socket.destroyed = true
      socket.writable = false
    },
    destroySoon: () => void log.push('destroySoon'),
  })
  return socket
}

/**
 * Builds a registry over a fake clock.
 *
 * @param sink - A sink in place of the recording one.
 * @returns The registry and its surroundings.
 */
const build = (sink?: (event: ServiceEvent) => void): Harness => {
  const events: ServiceEvent[] = []
  const timers: Timer[] = []
  const clock = {
    now: () => 0,
    setTimeout: (callback: () => void, ms: number) => {
      const timer = { callback, ms, cleared: false }
      timers.push(timer)
      return timer
    },
    clearTimeout: (handle: unknown) => void ((handle as Timer).cleared = true),
  }
  const emit = sink ?? ((event: ServiceEvent) => void events.push(event))
  const connections = createConnections(clock, emit)
  return {
    connections,
    events,
    timers,
    open: () => {
      const socket = fakeSocket()
      connections.connection(socket as unknown as Socket)
      return socket
    },
    enter: (socket) => {
      const req = Object.assign(new PassThrough(), { method: 'POST', url: '/upload', headers: {}, complete: false, socket })
      const res = Object.assign(new EventEmitter(), { writableFinished: false })
      const exchange = createExchange(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
        { bodyBytes: 65536, trustedProxyHops: 0 },
        clock,
        emit,
        false
      )
      connections.enter(socket as unknown as Socket, exchange)
      return exchange
    },
  }
}

/**
 * Builds an error as Node hands one to a `clientError` listener.
 *
 * @param code - The error's code, or nothing for an error without one.
 * @returns The error.
 */
const coded = (code?: unknown): Error => Object.assign(new RangeError('Parse Error: never logged'), code === undefined ? {} : { code })

/**
 * Raises a client error on a socket.
 *
 * @param harness - The registry.
 * @param socket - The socket the error belongs to.
 * @param code - The error's code.
 */
const raise = (harness: Harness, socket: FakeSocket, code?: unknown): void => {
  harness.connections.clientError(coded(code), socket as unknown as Socket)
}

/**
 * Reads the outcome and the status of exchanges.
 *
 * @param exchanges - The exchanges to read.
 * @returns One pair per exchange.
 */
const states = (...exchanges: Exchange[]): unknown[][] => exchanges.map((exchange) => [exchange.outcome, exchange.status])

/**
 * Writes out the bare answer a protocol error gets.
 *
 * @param status - The status code and its reason phrase.
 * @returns The whole response as it goes onto the socket.
 */
const answer = (status: string): string => `HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`

describe('createConnections registry', () => {
  it('is not draining at first', () => {
    expect(build().connections.draining()).toBe(false)
  })

  it('tracks a socket from its connection, so a drain destroys it while it is idle', () => {
    const harness = build()
    const socket = harness.open()
    void harness.connections.drain(1000)
    expect(socket.log).toEqual(['destroy'])
  })

  it('forgets a socket at its close', () => {
    const harness = build()
    const socket = harness.open()
    socket.emit('close')
    void harness.connections.drain(1000)
    expect(socket.log).toEqual([])
  })

  it('counts a connection as busy while an exchange entered on it has not ended', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket)
    void harness.connections.drain(1000)
    expect(socket.log).toEqual([])
  })

  it('counts a connection as busy while the second of two exchanges has not ended', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket).res.emit('close')
    harness.enter(socket)
    void harness.connections.drain(1000)
    expect(socket.log).toEqual([])
  })

  it('counts a connection as idle again once every exchange on it ended', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket).res.emit('close')
    harness.enter(socket).res.emit('close')
    void harness.connections.drain(1000)
    expect(socket.log).toEqual(['destroy'])
  })

  it('leaves a kept-alive socket open when its exchange ends', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket).res.emit('close')
    expect(socket.log).toEqual([])
  })

  it('lifts the listener ceiling of a socket, since every exchange in flight listens for its close', () => {
    expect(build().open().getMaxListeners()).toBe(0)
  })
})

describe('createConnections clientError', () => {
  it.each([
    ['HPE_HEADER_OVERFLOW', '431 Request Header Fields Too Large'],
    ['ERR_HTTP_REQUEST_TIMEOUT', '408 Request Timeout'],
    ['HPE_INVALID_METHOD', '400 Bad Request'],
    ['HPE_INVALID_CHUNK_SIZE', '400 Bad Request'],
  ])('answers %s with a bare %s', (code, status) => {
    const harness = build()
    const socket = harness.open()
    socket.bytesRead = 12
    raise(harness, socket, code)
    expect(socket.written).toEqual([answer(status)])
  })

  it.each([
    ['HPE_HEADER_OVERFLOW', 'header-overflow'],
    ['ERR_HTTP_REQUEST_TIMEOUT', 'request-timeout'],
    ['HPE_INVALID_METHOD', 'malformed-request'],
  ])('reports %s once as %s, with the name of the error and nothing of a request', (code, reported) => {
    const harness = build()
    const socket = harness.open()
    socket.bytesRead = 12
    raise(harness, socket, code)
    expect(harness.events).toEqual([{ type: 'failure', code: reported, name: 'RangeError', method: null, route: null, path: null }])
  })

  it('freezes the failure event', () => {
    const harness = build()
    raise(harness, harness.open(), 'HPE_INVALID_METHOD')
    expect(Object.isFrozen(harness.events[0])).toBe(true)
  })

  it('destroys the socket right after its answer is written', () => {
    const harness = build()
    const socket = harness.open()
    raise(harness, socket, 'HPE_INVALID_METHOD')
    expect(socket.log).toEqual(['write', 'destroy'])
  })

  it('reports one failure for a connection whose parser raises a second error', () => {
    const harness = build()
    const socket = harness.open()
    raise(harness, socket, 'HPE_INVALID_METHOD')
    raise(harness, socket, 'HPE_INVALID_METHOD')
    expect(harness.events.length).toBe(1)
  })

  it('destroys the socket again, and writes nothing more, at a second error of its parser', () => {
    const harness = build()
    const socket = harness.open()
    raise(harness, socket, 'HPE_HEADER_OVERFLOW')
    raise(harness, socket, 'HPE_HEADER_OVERFLOW')
    expect(socket.log).toEqual(['write', 'destroy', 'destroy'])
  })

  it.each([['HPE_INVALID_EOF_STATE'], ['ECONNRESET'], ['EPIPE'], [undefined], [104]])(
    'destroys the socket and writes nothing for an error with the code %s',
    (code) => {
      const harness = build()
      const socket = harness.open()
      socket.bytesRead = 12
      raise(harness, socket, code)
      expect(socket.log).toEqual(['destroy'])
    }
  )

  it.each([['HPE_INVALID_EOF_STATE'], ['ECONNRESET'], [undefined]])('reports nothing for an error with the code %s', (code) => {
    const harness = build()
    raise(harness, harness.open(), code)
    expect(harness.events).toEqual([])
  })

  it('settles the exchanges of a client that left as closed by the client, at once', () => {
    const harness = build()
    const socket = harness.open()
    const first = harness.enter(socket)
    const second = harness.enter(socket)
    raise(harness, socket, 'ECONNRESET')
    expect({ states: states(first, second), aborted: second.context.signal.aborted }).toEqual({
      states: [
        ['client-closed', 0],
        ['client-closed', 0],
      ],
      aborted: true,
    })
  })

  it('destroys the socket instead of answering when it is not writable', () => {
    const harness = build()
    const socket = harness.open()
    socket.writable = false
    raise(harness, socket, 'HPE_INVALID_METHOD')
    expect(socket.log).toEqual(['destroy'])
  })

  it('still reports a protocol error it could not answer', () => {
    const harness = build()
    const socket = harness.open()
    socket.writable = false
    raise(harness, socket, 'HPE_INVALID_METHOD')
    expect(harness.events).toEqual([expect.objectContaining({ type: 'failure', code: 'malformed-request' })])
  })

  it('destroys the socket instead of answering when an exchange on it has written a head', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket)
    harness.enter(socket).noteStatus(200)
    raise(harness, socket, 'HPE_INVALID_CHUNK_SIZE')
    expect(socket.log).toEqual(['destroy'])
  })

  it('treats a request timeout on a connection that never sent a byte as a client that left', () => {
    const harness = build()
    const socket = harness.open()
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    expect({ log: socket.log, events: harness.events }).toEqual({ log: ['destroy'], events: [] })
  })

  it('answers a request timeout on a connection that sent part of a header block', () => {
    const harness = build()
    const socket = harness.open()
    socket.bytesRead = 1
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    expect({ written: socket.written, events: harness.events.length }).toEqual({ written: [answer('408 Request Timeout')], events: 1 })
  })

  it('answers a request timeout on a connection with an exchange in flight, whatever its byte count', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket)
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    expect(socket.written).toEqual([answer('408 Request Timeout')])
  })

  it('answers a header overflow on a connection whose byte count reads 0', () => {
    const harness = build()
    const socket = harness.open()
    raise(harness, socket, 'HPE_HEADER_OVERFLOW')
    expect(socket.written).toEqual([answer('431 Request Header Fields Too Large')])
  })

  it('marks every exchange on the connection as timed out, with the 408 it wrote', () => {
    const harness = build()
    const socket = harness.open()
    const first = harness.enter(socket)
    const second = harness.enter(socket)
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    expect(states(first, second)).toEqual([
      ['request-timeout', 408],
      ['request-timeout', 408],
    ])
  })

  it('marks every exchange on the connection as closed by the client, with the 400 it wrote', () => {
    const harness = build()
    const socket = harness.open()
    const first = harness.enter(socket)
    const second = harness.enter(socket)
    raise(harness, socket, 'HPE_INVALID_CHUNK_SIZE')
    expect(states(first, second)).toEqual([
      ['client-closed', 400],
      ['client-closed', 400],
    ])
  })

  it('aborts the signal of an exchange it marks', () => {
    const harness = build()
    const socket = harness.open()
    const exchange = harness.enter(socket)
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    expect(exchange.context.signal.aborted).toBe(true)
  })

  it('leaves an exchange that already has its outcome as it is', () => {
    const harness = build()
    const socket = harness.open()
    const settled = harness.enter(socket)
    settled.settleOutcome('shutdown')
    const open = harness.enter(socket)
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    expect(states(settled, open)).toEqual([
      ['shutdown', 0],
      ['request-timeout', 408],
    ])
  })

  it('marks the exchanges without a status when it could not answer', () => {
    const harness = build()
    const socket = harness.open()
    const writing = harness.enter(socket)
    writing.noteStatus(200)
    const queued = harness.enter(socket)
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    expect(states(writing, queued)).toEqual([
      ['request-timeout', 200],
      ['request-timeout', 0],
    ])
  })

  it('leaves the exchanges of another connection alone', () => {
    const harness = build()
    const other = harness.enter(harness.open())
    raise(harness, harness.open(), 'HPE_INVALID_METHOD')
    expect(states(other)).toEqual([[null, 0]])
  })

  it('forgets an exchange that ended before the error', () => {
    const harness = build()
    const socket = harness.open()
    const ended = harness.enter(socket)
    ended.noteStatus(200)
    ended.res.emit('close')
    raise(harness, socket, 'HPE_INVALID_METHOD')
    expect(socket.log).toEqual(['write', 'destroy'])
  })

  it('reports the failure before the request events of the exchanges it ends', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket)
    raise(harness, socket, 'ERR_HTTP_REQUEST_TIMEOUT')
    socket.emit('close')
    expect(harness.events.map((event) => event.type)).toEqual(['failure', 'request'])
  })

  it('answers on a socket it was never told about', () => {
    const harness = build()
    const socket = fakeSocket()
    raise(harness, socket, 'HPE_INVALID_METHOD')
    expect(socket.log).toEqual(['write', 'destroy'])
  })

  it('ignores a sink that throws', () => {
    const harness = build(() => {
      throw new Error('sink down')
    })
    const socket = harness.open()
    raise(harness, socket, 'HPE_INVALID_METHOD')
    expect(socket.log).toEqual(['write', 'destroy'])
  })
})

describe('createConnections closing', () => {
  it('closes no connection for the shutdown before the drain', () => {
    const harness = build()
    const socket = harness.open()
    expect(harness.connections.closing(socket as unknown as Socket, harness.enter(socket))).toBe(false)
  })

  it('closes a draining connection after its only exchange in flight', () => {
    const harness = build()
    const socket = harness.open()
    const exchange = harness.enter(socket)
    void harness.connections.drain(1000)
    expect(harness.connections.closing(socket as unknown as Socket, exchange)).toBe(true)
  })

  it('keeps a draining connection after an exchange with a later one in flight, so the later one is answered', () => {
    const harness = build()
    const socket = harness.open()
    const [first] = [harness.enter(socket), harness.enter(socket)]
    void harness.connections.drain(1000)
    expect(harness.connections.closing(socket as unknown as Socket, first)).toBe(false)
  })

  it('closes a draining connection after the exchange entered last, even while an earlier one is in flight', () => {
    const harness = build()
    const socket = harness.open()
    const [, second] = [harness.enter(socket), harness.enter(socket)]
    void harness.connections.drain(1000)
    expect(harness.connections.closing(socket as unknown as Socket, second)).toBe(true)
  })

  it('closes a draining connection after an exchange it does not count as in flight', () => {
    const harness = build()
    const socket = harness.open()
    const exchange = harness.enter(socket)
    socket.emit('close')
    void harness.connections.drain(1000)
    expect(harness.connections.closing(socket as unknown as Socket, exchange)).toBe(true)
  })
})

describe('createConnections drain', () => {
  it('turns draining', () => {
    const harness = build()
    void harness.connections.drain(1000)
    expect(harness.connections.draining()).toBe(true)
  })

  it('resolves at once with nothing open', async () => {
    expect(await build().connections.drain(1000)).toBeUndefined()
  })

  it('starts the grace timer and clears it when nothing is open', () => {
    const harness = build()
    void harness.connections.drain(1500)
    expect(harness.timers.map(({ ms, cleared }) => ({ ms, cleared }))).toEqual([{ ms: 1500, cleared: true }])
  })

  it('destroys idle sockets and leaves busy ones', () => {
    const harness = build()
    const idle = harness.open()
    const busy = harness.open()
    harness.enter(busy)
    void harness.connections.drain(1000)
    expect({ idle: idle.log, busy: busy.log }).toEqual({ idle: ['destroy'], busy: [] })
  })

  it('waits while a socket is open', async () => {
    const harness = build()
    harness.open()
    const state = { resolved: false }
    void harness.connections.drain(1000).then(() => void (state.resolved = true))
    await flushPromises()
    expect({ resolved: state.resolved, cleared: harness.timers[0]?.cleared }).toEqual({ resolved: false, cleared: false })
  })

  it('resolves when the last socket has closed', async () => {
    const harness = build()
    const first = harness.open()
    const second = harness.open()
    const drained = harness.connections.drain(1000)
    first.emit('close')
    second.emit('close')
    expect(await drained).toBeUndefined()
  })

  it('does not resolve when the first of two sockets has closed', async () => {
    const harness = build()
    const first = harness.open()
    harness.open()
    const state = { resolved: false }
    void harness.connections.drain(1000).then(() => void (state.resolved = true))
    first.emit('close')
    await flushPromises()
    expect(state.resolved).toBe(false)
  })

  it('clears the grace timer when the drain finishes first', () => {
    const harness = build()
    const socket = harness.open()
    void harness.connections.drain(1000)
    socket.emit('close')
    expect(harness.timers[0]?.cleared).toBe(true)
  })

  it('closes a busy socket when its only exchange ends', () => {
    const harness = build()
    const socket = harness.open()
    const exchange = harness.enter(socket)
    void harness.connections.drain(1000)
    exchange.res.emit('close')
    expect(socket.log).toEqual(['destroySoon'])
  })

  it('leaves a busy socket open when the first of its two exchanges ends', () => {
    const harness = build()
    const socket = harness.open()
    const first = harness.enter(socket)
    harness.enter(socket)
    void harness.connections.drain(1000)
    first.res.emit('close')
    expect(socket.log).toEqual([])
  })

  it('closes a busy socket when the last of its two exchanges ends', () => {
    const harness = build()
    const socket = harness.open()
    const first = harness.enter(socket)
    const second = harness.enter(socket)
    void harness.connections.drain(1000)
    first.res.emit('close')
    second.res.emit('close')
    expect(socket.log).toEqual(['destroySoon'])
  })

  it('does not close a socket that is already destroyed when its last exchange ends', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket)
    void harness.connections.drain(1000)
    socket.destroyed = true
    socket.emit('close')
    expect(socket.log).toEqual([])
  })

  it('closes a socket whose exchange was entered while draining', () => {
    const harness = build()
    const socket = harness.open()
    const first = harness.enter(socket)
    void harness.connections.drain(1000)
    const second = harness.enter(socket)
    first.res.emit('close')
    second.res.emit('close')
    expect(socket.log).toEqual(['destroySoon'])
  })

  it('marks every exchange still in flight as shut down when the grace runs out', () => {
    const harness = build()
    const socket = harness.open()
    const first = harness.enter(socket)
    const second = harness.enter(harness.open())
    const third = harness.enter(socket)
    void harness.connections.drain(1000)
    harness.timers[0]?.callback()
    expect(states(first, second, third)).toEqual([
      ['shutdown', 0],
      ['shutdown', 0],
      ['shutdown', 0],
    ])
  })

  it('aborts the signal of an exchange it cuts at the grace', () => {
    const harness = build()
    const exchange = harness.enter(harness.open())
    void harness.connections.drain(1000)
    harness.timers[0]?.callback()
    expect(exchange.context.signal.aborted).toBe(true)
  })

  it('destroys every remaining socket when the grace runs out', () => {
    const harness = build()
    const first = harness.open()
    const second = harness.open()
    harness.enter(first)
    harness.enter(second)
    void harness.connections.drain(1000)
    harness.timers[0]?.callback()
    expect({ first: first.log, second: second.log }).toEqual({ first: ['destroy'], second: ['destroy'] })
  })

  it('leaves an exchange that has its outcome as it is at the grace', () => {
    const harness = build()
    const exchange = harness.enter(harness.open())
    exchange.settleOutcome('sent')
    void harness.connections.drain(1000)
    harness.timers[0]?.callback()
    expect(exchange.outcome).toBe('sent')
  })

  it('resolves once the sockets cut at the grace have closed', async () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket)
    const drained = harness.connections.drain(0)
    harness.timers[0]?.callback()
    socket.emit('close')
    expect(await drained).toBeUndefined()
  })

  it('reports an exchange cut at the grace as shut down', () => {
    const harness = build()
    const socket = harness.open()
    harness.enter(socket)
    void harness.connections.drain(1000)
    harness.timers[0]?.callback()
    socket.emit('close')
    expect(harness.events).toEqual([expect.objectContaining({ type: 'request', status: 0, outcome: 'shutdown' })])
  })
})
