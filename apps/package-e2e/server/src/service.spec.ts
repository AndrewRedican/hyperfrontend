/**
 * Service E2E tests for `@hyperfrontend/server`.
 *
 * The packed tarball is installed into a consumer outside the workspace, and the suite writes a hello service into it as
 * an ES module and as CommonJS. Each program runs as a process of its own under plain Node, on the kernel's runner: it
 * answers requests on a port the operating system picks, refuses a wrong environment, and stops on a closed channel, on a
 * signal and on an unhandled rejection. A job with no listener shows that the runner holds a process nothing else holds.
 */

import type { ChildProcess, StdioOptions } from 'node:child_process'
import type { IncomingHttpHeaders } from 'node:http'
import type { ChildExit } from '@hyperfrontend/testing/process'
import { spawn } from 'node:child_process'
import { request } from 'node:http'
import { join } from 'node:path'
import { after, before } from 'node:test'
import { describe, expect, it, sleep, waitUntil } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'
import { cleanSignalExit, sendSignal } from '@hyperfrontend/testing/process'

/** The module kinds a program is written in, by file extension. */
type ModuleKind = 'mjs' | 'cjs'

/** A process the suite started, with what it wrote. */
interface Service {
  /** The process. */
  readonly child: ChildProcess
  /** Reads everything written to standard output so far. */
  readonly stdout: () => string
  /** Reads everything written to standard error so far. */
  readonly stderr: () => string
  /** Reads how the process ended, once it has and both streams have closed. */
  readonly exit: () => ChildExit | undefined
}

/** What one request to a service came back with. */
interface Answer {
  /** The response status. */
  readonly status: number | undefined
  /** The response headers. */
  readonly headers: IncomingHttpHeaders
  /** The body as text. */
  readonly body: string
}

/** A service stopped while one of its requests was in flight. */
interface DrainedStop {
  /** What the request in flight came back with. */
  readonly answer: Answer
  /** How the process ended. */
  readonly exit: ChildExit
}

// note: 30s bounds every wait on a line, a response or an exit: slack for slow CI hosts, and inside the timeout of the format, so a wait that fails says what the process wrote.
const WAIT_MS = 30000

/** The line the hello service writes itself when a request to `/wait` reaches its handler: what shows the suite that the request is in flight. */
const IN_FLIGHT_LINE = 'waiting'

/** The variables the hello service declares, which the machine running the suite may not hand to it. */
const DECLARED_VARIABLES = ['PORT', 'HOST', 'HELLO_GREETING']

/** The environment a hello service boots with. */
const HELLO_ENVIRONMENT = { PORT: '0', HELLO_GREETING: 'Hello' }

/** The names a hello program takes from the main entry and from the environment entry. */
const HELLO_NAMES = {
  main: 'defineService, health, jsonResponse, readiness, route, router, runService, startService',
  environment: 'asPort, asText, defineEnvironment, optional, required',
}

/** How each module kind loads the entries, the same statements but for the module system. */
const HELLO_LOADS: Record<ModuleKind, readonly string[]> = {
  mjs: [
    `import { ${HELLO_NAMES.main} } from '@hyperfrontend/server'`,
    `import { ${HELLO_NAMES.environment} } from '@hyperfrontend/server/environment'`,
  ],
  cjs: [
    `const { ${HELLO_NAMES.main} } = require('@hyperfrontend/server')`,
    `const { ${HELLO_NAMES.environment} } = require('@hyperfrontend/server/environment')`,
  ],
}

/** The whole of a job: a service with no listener and no variables. */
const JOB_CALL = 'runService(defineService({ environment: defineEnvironment({}), start: () => ({ close: async () => undefined }) }))'

/** The job in each module kind. */
const JOB_PROGRAMS: Record<ModuleKind, string> = {
  mjs: [
    "import { defineService, runService } from '@hyperfrontend/server'",
    "import { defineEnvironment } from '@hyperfrontend/server/environment'",
    JOB_CALL,
    '',
  ].join('\n'),
  cjs: [
    "'use strict'",
    "const { defineService, runService } = require('@hyperfrontend/server')",
    "const { defineEnvironment } = require('@hyperfrontend/server/environment')",
    JOB_CALL,
    '',
  ].join('\n'),
}

/**
 * Writes the hello service: one call of the runner around a routed service, with no wrapper and no top-level `await`.
 *
 * @param kind - The module system the program loads the package through.
 * @returns The program's source.
 */
function helloProgram(kind: ModuleKind): string {
  return [
    ...HELLO_LOADS[kind],
    '',
    'const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))',
    'let listening = false',
    'runService(',
    '  defineService({',
    '    environment: defineEnvironment({',
    "      http: { PORT: optional(asPort({ allowZero: true }), 8080), HOST: optional(asText(), '127.0.0.1') },",
    '      hello: { HELLO_GREETING: required(asText()) },',
    '    }),',
    '    async start(values, context) {',
    '      const handle = await startService(',
    '        {',
    '          port: values.http.PORT,',
    '          host: values.http.HOST,',
    '          steps: [',
    '            health(),',
    '            readiness({ checks: { listening: () => listening } }),',
    '            router({',
    "              hello: route('GET', '/hello/:name', (request) => jsonResponse(200, { message: values.hello.HELLO_GREETING + ', ' + request.params.name })),",
    // why: the line is the service's own, written when the handler runs, so the suite stops the service on something it saw and not after a guessed delay.
    `              wait: route('GET', '/wait', async () => (process.stdout.write('${IN_FLIGHT_LINE}\\n'), await pause(500), jsonResponse(200, { waited: true }))),`,
    "              fault: route('POST', '/fault', () => (void Promise.reject(new Error('fault-marker\\n    at fault-marker (evil:1:1)')), jsonResponse(202, { accepted: true }))),",
    '            }),',
    '          ],',
    '        },',
    '        { report: context.report }',
    '      )',
    '      listening = true',
    '      return handle',
    '    },',
    '  })',
    ')',
    '',
  ].join('\n')
}

/**
 * Splits what a process wrote into the lines it has finished.
 *
 * @param text - Everything read from a stream so far.
 * @returns The lines that ended with a line feed, without it.
 */
function lines(text: string): string[] {
  return text.split(/\r?\n/).slice(0, -1)
}

/**
 * Builds the environment a program inherits: this process's, without the variables the hello service declares and without the test runner's own.
 *
 * @returns Variables for a child that reads only what the suite sets.
 */
function inheritedEnvironment(): NodeJS.ProcessEnv {
  const kept = Object.entries(process.env).filter(
    ([name]) => !DECLARED_VARIABLES.includes(name.toUpperCase()) && name !== 'NODE_TEST_CONTEXT' && !name.startsWith('HF_TEST_')
  )
  return Object.fromEntries(kept)
}

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

/**
 * Starts a program of the consumer as a process of its own under plain Node.
 *
 * @param file - The program, relative to the consumer.
 * @param variables - The variables set for it.
 * @param channel - Whether the process gets an IPC channel to this one.
 * @returns The process and readers of what it writes.
 */
function startProgram(file: string, variables: NodeJS.ProcessEnv, channel = true): Service {
  const stdio: StdioOptions = channel ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe']
  const child = spawn(process.execPath, [join(consumer.path, file)], {
    cwd: consumer.path,
    env: { ...inheritedEnvironment(), ...variables },
    stdio,
  })
  let stdout = ''
  let stderr = ''
  let exit: ChildExit | undefined
  let openStreams = 2
  const closed = (): void => {
    openStreams -= 1
  }
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk))
  // why: Node never emits 'close' for a child whose channel this process disconnected, so the end is the exit and the close of both streams.
  child.stdout?.once('close', closed)
  child.stderr?.once('close', closed)
  child.once('exit', (code, signal) => {
    exit = { code, signal }
  })
  return { child, stdout: () => stdout, stderr: () => stderr, exit: () => (openStreams === 0 ? exit : undefined) }
}

/**
 * Waits for something a process shows: a line, or its end.
 *
 * @param service - The process.
 * @param what - What is waited for, for the failure.
 * @param read - Reads it; a falsy value says it is not there yet.
 * @returns What was read.
 */
async function observed<Value>(service: Service, what: string, read: () => Value): Promise<NonNullable<Value>> {
  let ended = false
  try {
    return await waitUntil(
      () => {
        const value = read()
        ended = !value && service.exit() !== undefined
        if (ended) throw new Error(what)
        return value
      },
      { timeout: WAIT_MS, interval: 10 }
    )
  } catch {
    const reason = ended ? 'the process ended first' : `${WAIT_MS} ms passed`
    throw new Error(`${what} did not show: ${reason}.\nstandard output:\n${service.stdout()}\nstandard error:\n${service.stderr()}`)
  }
}

/**
 * Waits for the started line of a service.
 *
 * @param service - The process.
 * @returns The port the line carries, or `NaN` for a service without a listener.
 */
async function started(service: Service): Promise<number> {
  const line = await observed(service, 'the started line', () =>
    lines(service.stdout()).find((written) => written.split(' ')[0] === 'started')
  )
  return Number(/ port=([0-9]+)/.exec(line)?.[1])
}

/**
 * Waits for the end of a process.
 *
 * @param service - The process.
 * @returns Its exit code or the signal that ended it.
 */
function ended(service: Service): Promise<ChildExit> {
  return observed(service, 'the end of the process', service.exit)
}

/**
 * Ends a process a suite left running and waits until it is gone, so that the consumer's directory can be deleted.
 *
 * @param service - The process, when the suite got as far as starting one.
 */
async function discard(service: Service | undefined): Promise<void> {
  if (service === undefined || service.exit() !== undefined) return
  service.child.kill('SIGKILL')
  await ended(service)
}

/**
 * Sends one request to a service on a connection of its own.
 *
 * @param service - The process, for the failure.
 * @param port - The port it listens on.
 * @param method - The request method.
 * @param target - The request target, percent-encoded.
 * @returns The status, the headers and the body.
 */
function send(service: Service, port: number, method: string, target: string): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: '127.0.0.1', port, method, path: target, agent: false }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () =>
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') })
      )
    })
    outgoing.setTimeout(WAIT_MS, () => outgoing.destroy(new Error(`no answer in ${WAIT_MS} ms`)))
    outgoing.on('error', (error) => {
      const written = `standard output:\n${service.stdout()}\nstandard error:\n${service.stderr()}`
      reject(new Error(`${method} ${target} failed: ${error.message}.\n${written}`))
    })
    outgoing.end()
  })
}

/**
 * Stops a hello service while a request to `/wait` is in flight.
 *
 * @param service - The process.
 * @param stop - Asks the process to stop, once the request has reached its handler.
 * @returns What the request came back with, and how the process ended.
 */
async function stopInFlight(service: Service, stop: () => unknown): Promise<DrainedStop> {
  const port = await started(service)
  const asked = observed(service, 'the line of the request in flight', () => lines(service.stdout()).includes(IN_FLIGHT_LINE)).then(stop)
  const [answer] = await Promise.all([send(service, port, 'GET', '/wait'), asked])
  return { answer, exit: await ended(service) }
}

/** Whether a signal reaches a listener of the child: Windows has none to deliver, so a signalled child there ends outright. */
const SIGNALS_ARRIVE = process.platform !== 'win32'

const itWhereSignalsArrive = SIGNALS_ARRIVE ? it : it.skip

const KINDS: readonly ModuleKind[] = ['mjs', 'cjs']

before(() =>
  consumer.writeTree({
    'hello.mjs': helloProgram('mjs'),
    'hello.cjs': `'use strict'\n${helloProgram('cjs')}`,
    'job.mjs': JOB_PROGRAMS.mjs,
    'job.cjs': JOB_PROGRAMS.cjs,
  })
)

KINDS.forEach((kind) => {
  describe(`@hyperfrontend/server hello.${kind}`, () => {
    describe('serving', () => {
      let service: Service | undefined
      let routed: Answer | undefined
      let healthz: Answer | undefined
      let readyz: Answer | undefined
      let refusedMethod: Answer | undefined
      let unknownPath: Answer | undefined
      let encodedSlash: Answer | undefined

      before(async () => {
        service = startProgram(`hello.${kind}`, HELLO_ENVIRONMENT)
        const port = await started(service)
        routed = await send(service, port, 'GET', '/hello/w%C3%B6rld')
        healthz = await send(service, port, 'GET', '/healthz')
        readyz = await send(service, port, 'GET', '/readyz')
        refusedMethod = await send(service, port, 'POST', '/hello/x')
        unknownPath = await send(service, port, 'GET', '/nowhere')
        encodedSlash = await send(service, port, 'GET', '/hello/a%2Fb')
        // why: the events of the requests are read once the process has ended, when all of them have been written.
        service.child.disconnect()
        await ended(service)
      })

      after(() => discard(service))

      it('prints one started line', () => {
        const startedLines = lines(service?.stdout() ?? '').filter((line) => line.startsWith('started'))
        expect(startedLines).toEqual([expect.stringMatching(/^started port=[1-9][0-9]{0,4}$/)])
      })

      it('answers a routed JSON request', () => {
        const answer = { status: routed?.status, type: routed?.headers['content-type'], body: JSON.parse(routed?.body ?? 'null') }
        expect(answer).toEqual({ status: 200, type: 'application/json; charset=utf-8', body: { message: 'Hello, w\u00f6rld' } })
      })

      it('answers /healthz', () => {
        expect({ status: healthz?.status, body: healthz?.body }).toEqual({ status: 200, body: 'ok' })
      })

      it('answers /readyz', () => {
        const answer = { status: readyz?.status, body: JSON.parse(readyz?.body ?? 'null') }
        expect(answer).toEqual({ status: 200, body: { ready: true, checks: { listening: true } } })
      })

      it('refuses a method the route does not have', () => {
        expect({ status: refusedMethod?.status, allow: refusedMethod?.headers.allow }).toEqual({ status: 405, allow: 'GET, HEAD' })
      })

      it('reports the refused method by route name', () => {
        expect(lines(service?.stdout() ?? '')).toEqual(
          expect.arrayContaining([expect.stringContaining('request method=POST route=hello status=405')])
        )
      })

      it('answers 404 for an unknown path', () => {
        expect(unknownPath?.status).toBe(404)
      })

      it('answers 400 for an encoded slash', () => {
        expect(encodedSlash?.status).toBe(400)
      })

      it('reports each request by route name', () => {
        const sent = 'request method=GET route=hello status=200 outcome=sent'
        expect(lines(service?.stdout() ?? '')).toEqual(expect.arrayContaining([expect.stringContaining(sent)]))
      })

      it('leaks no routed path into a line', () => {
        // note: the static part of the path is what is looked for, since an event would carry the name escaped.
        expect(lines(service?.stdout() ?? '').filter((line) => line.includes('/hello/'))).toEqual([])
      })
    })

    describe('stopped by a closed channel', () => {
      let service: Service | undefined
      let stop: DrainedStop | undefined

      before(async () => {
        service = startProgram(`hello.${kind}`, HELLO_ENVIRONMENT)
        const { child } = service
        stop = await stopInFlight(service, () => child.disconnect())
      })

      after(() => discard(service))

      it('answers the request in flight', () => {
        const answer = { status: stop?.answer.status, body: JSON.parse(stop?.answer.body ?? 'null') }
        expect(answer).toEqual({ status: 200, body: { waited: true } })
      })

      it('names the closed channel as the cause to stop', () => {
        expect(lines(service?.stdout() ?? '')).toContain('stopping cause=disconnect')
      })

      it('ends standard output with the stopped line', () => {
        expect(lines(service?.stdout() ?? '').at(-1)).toBe('stopped')
      })

      it('exits 0', () => {
        expect(stop?.exit).toEqual({ code: 0, signal: null })
      })
    })

    describe('with a wrong environment', () => {
      let service: Service | undefined
      let exit: ChildExit | undefined

      before(async () => {
        service = startProgram(`hello.${kind}`, { PORT: 'not-a-port-marker' })
        exit = await ended(service)
      })

      after(() => discard(service))

      it('exits 78', () => {
        expect(exit).toEqual({ code: 78, signal: null })
      })

      it('names every variable that is wrong, and nothing else, on standard error', () => {
        expect(service?.stderr()).toBe(
          [
            'fatal cause=environment',
            '  - PORT (http) is malformed; expected an integer between 0 and 65535.',
            '  - HELLO_GREETING (hello) is missing; expected non-empty text.',
            '',
          ].join('\n')
        )
      })

      it('echoes no value of a variable on either stream', () => {
        expect(`${service?.stdout()}${service?.stderr()}`).not.toContain('not-a-port-marker')
      })

      it('prints no started line', () => {
        expect(lines(service?.stdout() ?? '').filter((line) => line.startsWith('started'))).toEqual([])
      })
    })

    describe('stopped by SIGINT', () => {
      let service: Service | undefined
      let stop: DrainedStop | undefined
      let signalled: ChildExit | undefined

      before(async () => {
        if (!SIGNALS_ARRIVE) return
        service = startProgram(`hello.${kind}`, HELLO_ENVIRONMENT)
        const { child } = service
        stop = await stopInFlight(service, async () => {
          signalled = await sendSignal(child, 'SIGINT')
        })
      })

      after(() => discard(service))

      itWhereSignalsArrive('answers the request in flight', () => {
        const answer = { status: stop?.answer.status, body: JSON.parse(stop?.answer.body ?? 'null') }
        expect(answer).toEqual({ status: 200, body: { waited: true } })
      })

      itWhereSignalsArrive('names the signal as the cause to stop', () => {
        expect(lines(service?.stdout() ?? '')).toContain('stopping cause=signal signal=SIGINT')
      })

      itWhereSignalsArrive('ends standard output with the stopped line', () => {
        expect(lines(service?.stdout() ?? '').at(-1)).toBe('stopped')
      })

      itWhereSignalsArrive('exits cleanly', () => {
        expect(signalled).toEqual(cleanSignalExit('SIGINT'))
      })
    })

    describe('signalled twice while it drains', () => {
      let service: Service | undefined
      let stop: DrainedStop | undefined

      before(async () => {
        if (!SIGNALS_ARRIVE) return
        service = startProgram(`hello.${kind}`, HELLO_ENVIRONMENT)
        const { child } = service
        stop = await stopInFlight(service, async () => {
          const first = sendSignal(child, 'SIGINT')
          // why: a terminal and a parent that forwards the signal deliver it twice, a moment apart.
          await sleep(100)
          await Promise.all([first, sendSignal(child, 'SIGINT')])
        })
      })

      after(() => discard(service))

      itWhereSignalsArrive('still answers the request in flight', () => {
        const answer = { status: stop?.answer.status, body: JSON.parse(stop?.answer.body ?? 'null') }
        expect(answer).toEqual({ status: 200, body: { waited: true } })
      })

      itWhereSignalsArrive('still exits cleanly', () => {
        expect(stop?.exit).toEqual(cleanSignalExit('SIGINT'))
      })
    })

    describe('with an unhandled rejection', () => {
      let service: Service | undefined
      let accepted: Answer | undefined
      let exit: ChildExit | undefined

      before(async () => {
        service = startProgram(`hello.${kind}`, HELLO_ENVIRONMENT)
        const port = await started(service)
        accepted = await send(service, port, 'POST', '/fault')
        exit = await ended(service)
      })

      after(() => discard(service))

      it('answers the request that caused it', () => {
        expect(accepted?.status).toBe(202)
      })

      it('exits 1', () => {
        expect(exit).toEqual({ code: 1, signal: null })
      })

      it('reports the rejection by name and frames', () => {
        const head = lines(service?.stderr() ?? '').slice(0, 2)
        expect(head).toEqual(['fatal cause=unhandled-rejection name=Error', expect.stringMatching(/^ {4}at /)])
      })

      it('prints no line of the message on either stream', () => {
        expect(`${service?.stdout()}${service?.stderr()}`).not.toContain('fault-marker')
      })

      it('ends standard output with the stopped line', () => {
        expect(lines(service?.stdout() ?? '').at(-1)).toBe('stopped')
      })
    })

    describe(`job.${kind}, with no listener and no channel`, () => {
      let service: Service | undefined
      let held: boolean | undefined
      let signalled: ChildExit | undefined

      before(async () => {
        service = startProgram(`job.${kind}`, {}, false)
        await started(service)
        // why: a process nothing holds ends by itself right after its started line, so half a second without an exit shows the runner holds it.
        await sleep(500)
        held = service.child.exitCode === null && service.child.signalCode === null
        if (!SIGNALS_ARRIVE) return
        signalled = await sendSignal(service.child, 'SIGTERM')
        await ended(service)
      })

      after(() => discard(service))

      it('is still running half a second after its started line', () => {
        expect(held).toBe(true)
      })

      itWhereSignalsArrive('writes the three lines of a clean stop and nothing else', () => {
        expect(service?.stdout()).toBe('started\nstopping cause=signal signal=SIGTERM\nstopped\n')
      })

      itWhereSignalsArrive('exits cleanly on SIGTERM', () => {
        expect(signalled).toEqual(cleanSignalExit('SIGTERM'))
      })
    })
  })
})
