import type { IncomingHttpHeaders } from 'node:http'
import type { Socket } from 'node:net'
import type { Handler, ServiceResponse, Step } from './contract'
import type { ServiceEvent } from './events'
import type { ServiceHandle, ServiceOptions } from './service'
import { Agent, METHODS, get, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import { Readable } from 'node:stream'
import { afterEach } from 'node:test'
import { describe, expect, it, sleep, waitUntil } from '@hyperfrontend/testing'
import { httpError } from './http-error'
import { jsonResponse } from './responses'
import { route, router } from './router'
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
  /** Reads what was received as text, one character per byte. */
  text(): string
  /** Lists the status of every response head received, joined with commas. */
  statuses(): string
}

/** What one request through Node's client is sent with. */
interface Asking {
  /** The request method; `GET` when omitted. */
  readonly method?: string
  /** The request target; `/` when omitted. */
  readonly path?: string
  /** The request headers. */
  readonly headers?: Record<string, string>
}

/** A draining service with a connection in each state. */
interface Busy {
  /** The service. */
  readonly service: Running
  /** A kept-alive connection whose request was answered. */
  readonly idle: Client
  /** A connection whose request takes 150 ms. */
  readonly waiting: Client
  /** A connection whose request never answers. */
  readonly hung: Client
  /** The signal of the request that never answers. */
  readonly stuck: AbortSignal[]
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
// why: Node's HTTP parser answers 400 to a method it does not know, so a QUERY request reaches a service only on a version that lists the method
const itWhereQueryIsParsed = METHODS.includes('QUERY') ? it : it.skip

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
 * Sends one request through Node's client. It never rejects: a transport failure is part of the answer.
 *
 * @param port - The port of the service.
 * @param options - The method, the path and the headers; a `GET /` when omitted.
 * @param body - The request body, if any.
 * @returns What arrived.
 */
const ask = (port: number, options: Asking = {}, body?: Buffer): Promise<Answer> =>
  new Promise((resolve) => {
    const outgoing = httpRequest({ port, host: '127.0.0.1', agent: false, ...options }, (res) => {
      const chunks: Buffer[] = []
      const answer = (): void =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), complete: res.complete })
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('error', answer)
      res.on('close', answer)
    })
    outgoing.on('error', () => resolve({ status: 0, headers: {}, body: Buffer.alloc(0), complete: false }))
    outgoing.end(body)
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

/**
 * Tells whether a head asks for its connection to be closed.
 *
 * @param text - What a raw client received.
 * @returns `true` when a `Connection: close` line is among the headers.
 */
const closesConnection = (text: string): boolean => /\r\nconnection: close\r\n/i.test(text)

const refuse: Handler = () => ({ status: 401, headers: {}, body: null })
const read: Handler = async (request) => ok(await request.body.bytes())

afterEach(async () => {
  // how: client sockets were registered after their service, so they go first and the drain finds nothing open
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

describe('a service on a real socket', () => {
  describe('bodies', () => {
    it('delivers a 5 MiB buffer whole, with its true length', async () => {
      const { port } = await serve([() => ok(Buffer.alloc(5 * MIB, 0x61))])
      const answer = await ask(port)
      expect({
        status: answer.status,
        received: answer.body.length,
        declared: answer.headers['content-length'],
        complete: answer.complete,
      }).toEqual({
        status: 200,
        received: 5 * MIB,
        declared: `${5 * MIB}`,
        complete: true,
      })
    })

    it('echoes 300 kB through body.stream(Infinity) while it is still arriving', async () => {
      const { port } = await serve([(request) => ok(request.body.stream(Infinity))])
      const sent = Buffer.alloc(300000, 0x62)
      const answer = await ask(port, { method: 'POST', headers: { 'Content-Length': `${sent.length}` } }, sent)
      expect({ status: answer.status, same: answer.body.equals(sent), complete: answer.complete }).toEqual({
        status: 200,
        same: true,
        complete: true,
      })
    })

    itWhereQueryIsParsed('answers a QUERY request that carries a JSON body from its route', async () => {
      const search = route('QUERY', '/tickets', async (request) => jsonResponse(200, { asked: await request.body.json() }))
      const { port } = await serve([router({ search })])
      const sent = Buffer.from('{"status":"open"}')
      const headers = { 'Content-Type': 'application/json', 'Content-Length': `${sent.length}` }
      const answer = await ask(port, { method: 'QUERY', path: '/tickets', headers }, sent)
      expect({ status: answer.status, body: answer.body.toString() }).toEqual({ status: 200, body: '{"asked":{"status":"open"}}' })
    })

    it('serves in silence on the URL of its handle when it is given no deps', async () => {
      const handle = await startService({ steps: [() => ok()], port: 0, host: '127.0.0.1' })
      cleanups.push(() => handle.close())
      expect({ status: (await ask(handle.port)).status, url: handle.url }).toEqual({ status: 200, url: `http://127.0.0.1:${handle.port}/` })
    })
  })

  describe('early response', () => {
    /**
     * Uploads towards a declared 4 MiB, a slice every few milliseconds, until a response head has arrived.
     *
     * @param port - The port of the service.
     * @param target - The request target.
     * @returns The client, which is still short of its declared length.
     */
    const upload = async (port: number, target: string): Promise<Client> => {
      const client = await open(port, `POST ${target} HTTP/1.1\r\nHost: service.test\r\nContent-Length: ${4 * MIB}\r\n\r\n`)
      const slice = Buffer.alloc(16384, 0x61)
      const timer = setInterval(() => client.socket.destroyed || client.socket.write(slice), 5)
      await settled(() => client.text().includes('\r\n\r\n'))
      clearInterval(timer)
      return client
    }

    it('answers 401 with Connection: close to a client still uploading 4 MiB', async () => {
      const { port } = await serve([refuse])
      const client = await upload(port, '/')
      expect({ statuses: client.statuses(), closes: closesConnection(client.text()) }).toEqual({ statuses: '401', closes: true })
    })

    it('answers 413 with Connection: close to a declared length past the cap, reading nothing', async () => {
      const { port } = await serve([read])
      const client = await upload(port, '/')
      expect({ statuses: client.statuses(), closes: closesConnection(client.text()) }).toEqual({ statuses: '413', closes: true })
    })

    it('answers 413 to a chunked body that passes the cap', async () => {
      const { port } = await serve([read])
      const answer = await ask(port, { method: 'POST', headers: { 'Transfer-Encoding': 'chunked' } }, Buffer.alloc(100000, 0x61))
      expect(answer.status).toBe(413)
    })
  })

  describe('continue', () => {
    /**
     * Sends the head of a request that expects something before its body.
     *
     * @param port - The port of the service.
     * @param length - The declared length of the body, of which nothing is sent.
     * @param expectation - The value of the `Expect` header.
     * @returns The client, once a response head has arrived.
     */
    const expecting = async (port: number, length: number, expectation = '100-continue'): Promise<Client> => {
      const client = await open(
        port,
        `POST / HTTP/1.1\r\nHost: service.test\r\nContent-Length: ${length}\r\nExpect: ${expectation}\r\n\r\n`
      )
      await settled(() => client.text().includes('\r\n\r\n'))
      return client
    }

    it('sends no 100 Continue before a refusal', async () => {
      const { port } = await serve([refuse])
      expect((await expecting(port, 10)).statuses()).toBe('401')
    })

    it('sends 100 Continue at the first read, then the answer', async () => {
      const { port } = await serve([read])
      const client = await expecting(port, 5)
      const interim = client.statuses()
      client.socket.write('hello')
      await settled(() => client.text().endsWith('hello'))
      expect({ interim, statuses: client.statuses() }).toEqual({ interim: '100', statuses: '100,200' })
    })

    it('sends no 100 Continue for a declared length past the cap', async () => {
      const { port } = await serve([read])
      expect((await expecting(port, 4 * MIB)).statuses()).toBe('413')
    })

    it('leaves another Expect value to Node, which answers 417', async () => {
      const { port } = await serve([read])
      expect((await expecting(port, 5, 'something-else')).statuses()).toBe('417')
    })
  })

  describe('keep-alive', () => {
    it('keeps the connection after a bodiless request and after a body read to its end', async () => {
      const { port } = await serve([byPath({ '/': () => ok(), '/read': read })])
      const client = await open(port, `GET / ${GET}`)
      await settled(() => client.statuses() === '200')
      client.socket.write('POST /read HTTP/1.1\r\nHost: service.test\r\nContent-Length: 5\r\n\r\nhello')
      await settled(() => client.statuses() === '200,200')
      client.socket.write(`GET / ${GET}`)
      await settled(() => client.statuses() === '200,200,200')
      expect({ statuses: client.statuses(), closes: closesConnection(client.text()), closed: client.closed }).toEqual({
        statuses: '200,200,200',
        closes: false,
        closed: false,
      })
    })

    it('keeps the connection after refusing the target of a bodiless request', async () => {
      const { port } = await serve([() => ok()])
      const client = await open(port, `GET /a%2Fb ${GET}`)
      await settled(() => client.statuses() === '400')
      client.socket.write(`GET / ${GET}`)
      await settled(() => client.statuses() === '400,200')
      expect({ statuses: client.statuses(), closes: closesConnection(client.text()) }).toEqual({ statuses: '400,200', closes: false })
    })

    it('carries twenty requests on one kept-alive connection without a listener warning', async () => {
      const service = await serve([() => ok()])
      const warnings: string[] = []
      const onWarning = (warning: Error): void => void warnings.push(warning.name)
      process.on('warning', onWarning)
      cleanups.push(() => process.removeListener('warning', onWarning))
      const agent = new Agent({ keepAlive: true, maxSockets: 1 })
      cleanups.push(() => agent.destroy())
      const sockets = new Set<Socket>()
      for (let index = 0; index < 20; index += 1) {
        await new Promise((resolve) =>
          get({ port: service.port, host: '127.0.0.1', agent }, (res) => res.resume().on('end', () => resolve(sockets.add(res.socket))))
        )
      }
      await settled(() => service.requests().length === 20)
      // how: a warning is emitted on the next tick after the listener that caused it was added
      await sleep(20)
      expect({ sockets: sockets.size, requests: service.requests().length, warnings }).toEqual({ sockets: 1, requests: 20, warnings: [] })
    })
  })

  describe('survival', () => {
    it('outlives a body stream that is cut short while the handler awaits something else', async () => {
      const seen: unknown[] = []
      const late: Handler = async (request) => {
        const stream = request.body.stream(10)
        await sleep(300)
        try {
          for await (const chunk of stream) void chunk
        } catch (error) {
          seen.push((error as { code?: string }).code)
        }
        return ok()
      }
      const service = await serve([late])
      const client = await open(service.port, 'POST /late HTTP/1.1\r\nHost: service.test\r\nContent-Length: 10\r\n\r\nabcd')
      await sleep(100)
      client.socket.destroy()
      await settled(() => seen.length === 1 && service.requests().length === 1)
      expect({ seen, requests: service.requests() }).toEqual({ seen: ['body-incomplete'], requests: [['/late', 0, 'client-closed']] })
    })

    it('answers 500 when a response stream errors while an outer step still holds the response', async () => {
      const hold: Step = async (_request, _context, next) => {
        const response = await next()
        await sleep(100)
        return response
      }
      const failing: Step = () => {
        const body = new Readable({ read: () => undefined })
        setTimeout(() => body.destroy(new Error('upstream reset')), 20)
        return ok(body)
      }
      const service = await serve([hold, failing])
      const answer = await ask(service.port)
      expect({ status: answer.status, failures: service.failures() }).toEqual({ status: 500, failures: ['stream-failed'] })
    })

    it('rejects a read that is pending when the client leaves after the response', async () => {
      let pending = 'pending'
      const answerFirst: Handler = (request) => {
        request.body.bytes(1000000).then(
          () => (pending = 'resolved'),
          (error: { code?: string }) => (pending = `rejected:${error.code}`)
        )
        return ok()
      }
      const { port } = await serve([answerFirst])
      const client = await open(port, 'POST / HTTP/1.1\r\nHost: service.test\r\nContent-Length: 1000\r\n\r\nabc')
      await settled(() => client.statuses() === '200')
      client.socket.destroy()
      await settled(() => pending !== 'pending')
      expect(pending).toBe('rejected:body-incomplete')
    })
  })

  describe('drain', () => {
    /**
     * Starts a service with one idle kept-alive connection, one request that takes 150 ms and one that never answers.
     *
     * @param graceMs - The grace of the service.
     * @returns The service, its three clients, and the signal of the request that never answers.
     */
    const busy = async (graceMs: number): Promise<Busy> => {
      const stuck: AbortSignal[] = []
      const table = {
        '/': () => ok(),
        '/wait': async () => (await sleep(150), ok(Buffer.from('waited'))),
        '/stuck': (_request, context) => (stuck.push(context.signal), new Promise<ServiceResponse>(() => undefined)),
      } satisfies Record<string, Handler>
      const service = await serve([byPath(table)], { graceMs })
      const idle = await open(service.port, `GET / ${GET}`)
      await settled(() => idle.statuses() === '200')
      const waiting = await open(service.port, `GET /wait ${GET}`)
      const hung = await open(service.port, `GET /stuck ${GET}`)
      await settled(() => stuck.length === 1)
      return { service, idle, waiting, hung, stuck }
    }

    it('closes an idle kept-alive socket at once, long before the grace cuts a stuck request', async () => {
      const { service, idle, hung } = await busy(1500)
      void service.handle.close()
      await settled(() => idle.closed)
      expect({ idle: idle.closed, hung: hung.closed }).toEqual({ idle: true, hung: false })
    })

    it('lets a request in flight finish, with Connection: close', async () => {
      const { service, waiting } = await busy(1500)
      void service.handle.close()
      await settled(() => waiting.closed)
      expect({ statuses: waiting.statuses(), closes: closesConnection(waiting.text()), whole: waiting.text().endsWith('waited') }).toEqual({
        statuses: '200',
        closes: true,
        whole: true,
      })
    })

    it('answers both requests of a pipelined pair in flight when the drain begins, each as sent', async () => {
      const started: string[] = []
      const wait: Handler = async (request) => (started.push(request.path), await sleep(150), ok(Buffer.from('waited')))
      const service = await serve([byPath({ '/a': wait, '/b': wait })], { graceMs: 1500 })
      const pair = await open(service.port, `GET /a ${GET}GET /b ${GET}`)
      await settled(() => started.length === 2)
      void service.handle.close()
      await settled(() => pair.closed)
      expect({ statuses: pair.statuses(), requests: service.requests() }).toEqual({
        statuses: '200,200',
        requests: [
          ['/a', 200, 'sent'],
          ['/b', 200, 'sent'],
        ],
      })
    })

    it('refuses a new connection', async () => {
      const { service } = await busy(1500)
      void service.handle.close()
      const refused = await new Promise((resolve) => {
        const late = connect(service.port, '127.0.0.1')
        late.on('error', () => resolve(true))
        late.on('connect', () => resolve(late.destroy().destroyed !== true))
      })
      expect(refused).toBe(true)
    })

    it('cuts a stuck request at the grace, with its signal aborted', async () => {
      const { service, hung, stuck } = await busy(300)
      await service.handle.close()
      await settled(() => hung.closed)
      expect({ closed: hung.closed, aborted: stuck.map((signal) => signal.aborted), requests: service.requests() }).toEqual({
        closed: true,
        aborted: [true],
        requests: expect.arrayContaining([['/stuck', 0, 'shutdown']]),
      })
    })

    it('resolves close() once everything was cut, with the same promise on every call', async () => {
      const { service } = await busy(300)
      const closing = service.handle.close()
      expect({ same: service.handle.close() === closing, outcome: await closing.then(() => 'closed') }).toEqual({
        same: true,
        outcome: 'closed',
      })
    })
  })
})
