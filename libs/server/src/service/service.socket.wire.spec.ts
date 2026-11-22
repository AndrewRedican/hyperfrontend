import type { IncomingHttpHeaders } from 'node:http'
import type { Socket } from 'node:net'
import type { Handler, ServiceResponse, Step } from './contract'
import type { ServiceEvent } from './events'
import type { ServiceHandle, ServiceOptions } from './service'
import { request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { PassThrough, Readable } from 'node:stream'
import { afterEach } from 'node:test'
import { describe, expect, it, sleep, waitUntil } from '@hyperfrontend/testing'
import { httpError } from './http-error'
import { startService } from './service'

/** A service on a loopback port and what its sink received. */
interface Running {
  /** The handle `startService` resolved with. */
  readonly handle: ServiceHandle
  /** The port the operating system chose. */
  readonly port: number
  /** Every event the sink received; a spec empties it to look at what follows. */
  readonly events: ServiceEvent[]
  /** Lists the request events as path, status and outcome. */
  requests(): unknown[][]
  /** Lists the codes of the failure events. */
  failures(): string[]
}

/** A raw client socket and what it was sent. */
interface Client {
  /** The socket, already connected. */
  readonly socket: Socket
  /** Whether the socket has closed. */
  closed: boolean
  /** Counts the bytes received. */
  received(): number
  /** Reads what was received as text, one character per byte. */
  text(): string
  /** Lists the status of every response head received, joined with commas. */
  statuses(): string
}

/** A service whose pipelined client left, and the signals of the two requests it had sent. */
interface Abandoned {
  /** The service. */
  readonly service: Running
  /** The signal of each request, in the order the handlers started. */
  readonly signals: AbortSignal[]
}

/** What Node's client made of one response. */
interface Answer {
  /** The status code, or 0 when the request failed before a head arrived. */
  readonly status: number
  /** The response headers. */
  readonly headers: IncomingHttpHeaders
  /** The body bytes received. */
  readonly body: Buffer
  /** Whether the whole response arrived. */
  readonly complete: boolean
}

const MIB = 1024 * 1024
const LIMITS = { headersTimeoutMs: 300, requestTimeoutMs: 900, writeIdleTimeoutMs: 400, graceMs: 300 }
const GET = 'HTTP/1.1\r\nHost: service.test\r\n\r\n'
const cleanups: (() => unknown)[] = []

/**
 * Starts a service on a loopback port with the short limits of this spec; it is closed after the test.
 *
 * @param steps - The pipeline to serve.
 * @param overrides - Options that differ from the short limits.
 * @returns The running service and the events it reported.
 */
const serve = async (steps: readonly Step[], overrides: Partial<ServiceOptions> = {}): Promise<Running> => {
  const events: ServiceEvent[] = []
  const handle = await startService(
    { steps, port: 0, host: '127.0.0.1', ...LIMITS, ...overrides },
    { report: (event) => void events.push(event) }
  )
  cleanups.push(() => handle.close())
  return {
    handle,
    port: handle.port,
    events,
    requests: () => events.flatMap((event) => (event.type === 'request' ? [[event.path, event.status, event.outcome]] : [])),
    failures: () => events.flatMap((event) => (event.type === 'failure' ? [event.code] : [])),
  }
}

/**
 * Sends a `GET /` through Node's client. It never rejects: a transport failure is part of the answer.
 *
 * @param port - The port of the service.
 * @returns What arrived.
 */
const ask = (port: number): Promise<Answer> =>
  new Promise((resolve) => {
    const outgoing = httpRequest({ port, host: '127.0.0.1', agent: false }, (res) => {
      const chunks: Buffer[] = []
      const answer = (): void =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), complete: res.complete })
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('error', answer)
      res.on('close', answer)
    })
    outgoing.on('error', () => resolve({ status: 0, headers: {}, body: Buffer.alloc(0), complete: false }))
    outgoing.end()
  })

/**
 * Opens a raw client socket that gathers what it is sent; it is destroyed after the test.
 *
 * @param port - The port of the service.
 * @param send - What to write as soon as the socket is connected.
 * @returns The connected client.
 */
const open = (port: number, send?: string | Buffer): Promise<Client> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = []
    const socket = connect(port, '127.0.0.1', () => {
      if (send !== undefined) {
        socket.write(send)
      }
      resolve(client)
    })
    const client: Client = {
      socket,
      closed: false,
      received: () => chunks.reduce((total, chunk) => total + chunk.length, 0),
      text: () => Buffer.concat(chunks).toString('latin1'),
      statuses: () => [...client.text().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((match) => match[1]).join(','),
    }
    socket.on('data', (chunk: Buffer) => chunks.push(chunk))
    socket.on('close', () => void (client.closed = true))
    socket.on('error', () => undefined)
    cleanups.push(() => socket.destroy())
  })

/**
 * Waits for a condition without failing when it never holds, so that the assertion after it shows what was there instead.
 *
 * @param condition - What to wait for.
 * @param timeout - How long to wait at most, in milliseconds.
 * @returns A promise that resolves when the condition holds or the time is up.
 */
const settled = (condition: () => boolean, timeout = 5000): Promise<unknown> =>
  waitUntil(condition, { timeout, interval: 5 }).catch(() => undefined)

/**
 * Builds a step that dispatches on the canonical path.
 *
 * @param table - One handler per path.
 * @returns The step; a path without a handler is a 404.
 */
const byPath =
  (table: Record<string, Handler>): Step =>
  (request, context) => {
    const handler = table[request.path]
    if (handler === undefined) {
      throw httpError(404, 'not-found')
    }
    return handler(request, context)
  }

/**
 * Builds a 200 response.
 *
 * @param body - The body; the two bytes `ok` when omitted.
 * @returns The response.
 */
const ok = (body: Buffer | Readable = Buffer.from('ok')): ServiceResponse => ({ status: 200, headers: {}, body })

afterEach(async () => {
  // how: client sockets were registered after their service, so they go first and the drain finds nothing open
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

describe('a service on a real socket, on the wire', () => {
  describe('pipelining', () => {
    /**
     * Sends a pipelined pair whose first request takes a second and whose second waits for its signal, then leaves.
     *
     * @param graceMs - The grace of the service.
     * @returns The service, once both request events arrived, and the signals of the two requests.
     */
    const abandon = async (graceMs: number): Promise<Abandoned> => {
      const signals: AbortSignal[] = []
      const table = {
        '/slow': async (_request, context) => (signals.push(context.signal), await sleep(1000), ok()),
        '/hold': async (_request, context) => {
          signals.push(context.signal)
          await new Promise((resolve) => context.signal.addEventListener('abort', resolve))
          return ok()
        },
      } satisfies Record<string, Handler>
      const service = await serve([byPath(table)], { graceMs })
      const client = await open(service.port, `GET /slow ${GET}GET /hold ${GET}`)
      await settled(() => signals.length === 2)
      client.socket.destroy()
      await settled(() => service.requests().length === 2)
      return { service, signals }
    }

    it('keeps the 100 Continue of a request queued behind a slow one out of its final response', async () => {
      const table = {
        '/slow': async () => (await sleep(150), ok(Buffer.from('slow'))),
        '/upload': async (request) => ok(await request.body.bytes()),
      } satisfies Record<string, Handler>
      const service = await serve([byPath(table)])
      const upload = 'POST /upload HTTP/1.1\r\nHost: service.test\r\nExpect: 100-continue\r\nContent-Length: 5\r\n\r\nhello'
      const client = await open(service.port, `GET /slow ${GET}${upload}`)
      await settled(() => client.text().endsWith('hello'))
      expect({ statuses: client.statuses(), body: client.text().endsWith('\r\n\r\nhello') }).toEqual({ statuses: '200,200', body: true })
    })

    it('delivers both responses of a pipelined pair whose first request is slower than the stall bound', async () => {
      const table = { '/slow': async () => (await sleep(1000), ok(Buffer.from('slow'))), '/second': () => ok(Buffer.alloc(200000, 0x62)) }
      const service = await serve([byPath(table)])
      const client = await open(service.port, `GET /slow ${GET}GET /second ${GET}`)
      await settled(() => client.received() > 200000 && service.requests().length === 2)
      expect({ statuses: client.statuses(), whole: client.received() > 200000, requests: service.requests() }).toEqual({
        statuses: '200,200',
        whole: true,
        requests: [
          ['/slow', 200, 'sent'],
          ['/second', 200, 'sent'],
        ],
      })
    })

    it('ends both exchanges of a pipelined pair whose client leaves, each with its signal aborted', async () => {
      const { service, signals } = await abandon(300)
      expect({ requests: service.requests(), aborted: signals.map((signal) => signal.aborted) }).toEqual({
        requests: [
          ['/slow', 0, 'client-closed'],
          ['/hold', 0, 'client-closed'],
        ],
        aborted: [true, true],
      })
    })

    it('keeps nothing tracked after a pipelined pair whose client left, so it closes long before its grace', async () => {
      const { service } = await abandon(10000)
      const began = performance.now()
      await service.handle.close()
      expect(performance.now() - began).toBeLessThan(5000)
    })

    it('cuts a queued large response to a client that stops reading only after the first response was sent', async () => {
      const table = { '/slow': async () => (await sleep(1000), ok(Buffer.from('slow'))), '/huge': () => ok(Buffer.alloc(32 * MIB, 0x63)) }
      const service = await serve([byPath(table)])
      const client = await open(service.port, `GET /slow ${GET}GET /huge ${GET}`)
      await settled(() => client.received() > 0)
      client.socket.pause()
      await settled(() => service.requests().length === 2, 10000)
      expect(service.requests()).toEqual([
        ['/slow', 200, 'sent'],
        ['/huge', 200, 'write-stalled'],
      ])
    })
  })

  describe('the responses of Node', () => {
    it('answers 408 to partial headers, with one request-timeout failure event', async () => {
      const service = await serve([() => ok()])
      const client = await open(service.port, 'GET / HTTP/1.1\r\nHost: service.test\r\n')
      await settled(() => client.closed)
      expect({ statuses: client.statuses(), failures: service.failures(), requests: service.requests() }).toEqual({
        statuses: '408',
        failures: ['request-timeout'],
        requests: [],
      })
    })

    it('closes a connection that never sends a byte, with no answer and no event', async () => {
      const service = await serve([() => ok()])
      const client = await open(service.port)
      await settled(() => client.closed)
      expect({ closed: client.closed, received: client.received(), events: service.events }).toEqual({
        closed: true,
        received: 0,
        events: [],
      })
    })

    it('answers 408 to a stalled body, with one request event whose outcome is request-timeout', async () => {
      const failed: unknown[] = []
      const service = await serve([
        (request) => request.body.bytes().then(ok, (error: { code?: string }) => (failed.push(error.code), ok())),
      ])
      const client = await open(service.port, 'POST /read HTTP/1.1\r\nHost: service.test\r\nContent-Length: 100\r\n\r\nabc')
      await settled(() => client.closed && service.requests().length === 1)
      expect({ statuses: client.statuses(), requests: service.requests(), failures: service.failures(), failed }).toEqual({
        statuses: '408',
        requests: [['/read', 408, 'request-timeout']],
        failures: ['request-timeout'],
        failed: ['body-incomplete'],
      })
    })

    it('answers 431 to a 20 kB header', async () => {
      const service = await serve([() => ok()])
      const client = await open(service.port, `GET / HTTP/1.1\r\nHost: service.test\r\nX-Big: ${'a'.repeat(20000)}\r\n\r\n`)
      await settled(() => client.closed)
      expect({ statuses: client.statuses(), failures: service.failures() }).toEqual({ statuses: '431', failures: ['header-overflow'] })
    })

    it('reports one failure for 1 MiB of garbage, which reaches the parser in more than one read', async () => {
      const service = await serve([() => ok()])
      const client = await open(service.port, Buffer.alloc(MIB, 'x'))
      await settled(() => client.closed)
      expect(service.failures()).toEqual(['malformed-request'])
    })

    it('answers 400 to garbage', async () => {
      const service = await serve([() => ok()])
      const client = await open(service.port, 'garbage\r\n\r\n')
      await settled(() => client.closed)
      expect({ statuses: client.statuses(), failures: service.failures() }).toEqual({ statuses: '400', failures: ['malformed-request'] })
    })

    it('answers 400 to a raw byte above 0x7F in the target', async () => {
      const { port } = await serve([() => ok()])
      const client = await open(port, Buffer.concat([Buffer.from('GET /caf'), Buffer.from([0xc3, 0xa9]), Buffer.from(` ${GET}`)]))
      await settled(() => client.statuses() !== '')
      expect(client.statuses()).toBe('400')
    })

    it('reports a client that leaves in the middle of an upload as client-closed with status 0, and no failure', async () => {
      const failed: unknown[] = []
      const service = await serve([
        (request) => request.body.bytes().then(ok, (error: { code?: string }) => (failed.push(error.code), ok())),
      ])
      const client = await open(service.port, 'POST /read HTTP/1.1\r\nHost: service.test\r\nContent-Length: 50000\r\n\r\nabc')
      await sleep(100)
      client.socket.destroy()
      await settled(() => service.requests().length === 1)
      expect({ requests: service.requests(), failures: service.failures(), failed }).toEqual({
        requests: [['/read', 0, 'client-closed']],
        failures: [],
        failed: ['body-incomplete'],
      })
    })

    it('reports no failure for a client that resets while a large response is written', async () => {
      const service = await serve([() => ok(Buffer.alloc(64 * MIB, 0x61))])
      const client = await open(service.port, `GET /big ${GET}`)
      await settled(() => client.received() > 100000)
      client.socket.resetAndDestroy()
      await settled(() => service.requests().length === 1)
      expect({ requests: service.requests(), failures: service.failures() }).toEqual({
        requests: [['/big', 200, 'client-closed']],
        failures: [],
      })
    })
  })

  describe('writer', () => {
    /**
     * Asks for `/` on a socket that never reads the answer, and waits for the request event.
     *
     * @param service - The service to ask.
     * @returns A promise that resolves once the exchange has ended.
     */
    const askWithoutReading = async (service: Running): Promise<void> => {
      const client = await open(service.port)
      client.socket.pause()
      client.socket.write(`GET / ${GET}`)
      await settled(() => service.requests().length === 1, 10000)
    }

    it('cuts a client that stops reading a large buffer as write-stalled', async () => {
      const service = await serve([() => ok(Buffer.alloc(64 * MIB, 0x61))])
      await askWithoutReading(service)
      expect({ requests: service.requests(), failures: service.failures() }).toEqual({
        requests: [['/', 200, 'write-stalled']],
        failures: [],
      })
    })

    it('cuts a client that stops reading a stream as write-stalled, and destroys the source', async () => {
      const source = new Readable({ read: () => void source.push(Buffer.alloc(65536, 0x62)) })
      const service = await serve([() => ok(source)])
      await askWithoutReading(service)
      expect({ requests: service.requests(), destroyed: source.destroyed, failures: service.failures() }).toEqual({
        requests: [['/', 200, 'write-stalled']],
        destroyed: true,
        failures: [],
      })
    })

    it('delivers everything to a slow reader that keeps taking bytes for longer than the stall bound', async () => {
      const service = await serve([() => ok(Buffer.alloc(32 * MIB, 0x63))])
      const client = await open(service.port)
      client.socket.pause()
      client.socket.write(`GET / ${GET}`)
      // how: the reader takes one chunk every 10 ms, far less than the socket could carry, so the writer waits again and again, and no wait lasts the 400 ms of the bound
      const reading = setInterval(() => void client.socket.once('data', () => client.socket.pause()).resume(), 10)
      cleanups.push(() => clearInterval(reading))
      await sleep(1200)
      const midway = { requests: service.requests(), partial: client.received() < 32 * MIB }
      clearInterval(reading)
      client.socket.resume()
      await settled(() => service.requests().length === 1 && client.received() > 32 * MIB, 20000)
      expect({ midway, requests: service.requests(), whole: client.received() > 32 * MIB }).toEqual({
        midway: { requests: [], partial: true },
        requests: [['/', 200, 'sent']],
        whole: true,
      })
    })

    it('leaves the client an incomplete response when a stream fails after its first byte', async () => {
      const failing: Step = () => {
        const body = new PassThrough()
        body.write('partial')
        setTimeout(() => body.destroy(new Error('upstream reset')), 50)
        return ok(body)
      }
      const service = await serve([failing])
      const answer = await ask(service.port)
      await settled(() => service.requests().length === 1)
      expect({ status: answer.status, complete: answer.complete, requests: service.requests(), failures: service.failures() }).toEqual({
        status: 200,
        complete: false,
        requests: [['/', 200, 'write-failed']],
        failures: ['stream-failed'],
      })
    })
  })
})
