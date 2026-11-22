# How to test a service from start to exit code without a process

You will write specs that take a whole service from its start to its exit code: a boot refused for a wrong environment, the started line, a stop that was asked for, a start that fails, a fault while it runs and a timeout. Each one runs in milliseconds, binds no port and sends no signal, and none of them can end the test runner.

How a service boots and stops is usually tested from outside: spawn it, wait for the port, send a signal, read the exit code, and allow for a slow machine at every wait. [`runService`](/docs/libraries/server#api-runService) from [`@hyperfrontend/server`](/docs/libraries/server) takes the process it acts on, and the clock it keeps time by, as parameters. A spec hands it a fake process, emits a signal as an event and awaits the exit code as a value.

The examples test a greeting service that reads a port and a greeting from the environment and answers one route. They use [`node:test`](https://nodejs.org/api/test.html) and [`node:assert`](https://nodejs.org/api/assert.html), which ship with Node.js; every spec is a function that awaits a promise, so any runner works.

## 1. Make the listener a parameter of the definition

A start function that calls [`startService`](/docs/libraries/server#api-startService) binds a port wherever it runs, a spec included. Wrap the [`defineService`](/docs/libraries/server#api-defineService) call in a function that takes the listener, with the real one as its default:

```ts
// service.ts
import type { ServiceDeps, ServiceOptions, StartedService } from '@hyperfrontend/server'
import { defineService, health, jsonResponse, route, router, startService } from '@hyperfrontend/server'
import { asPort, asText, defineEnvironment, optional, required } from '@hyperfrontend/server/environment'

export type Listen = (options: ServiceOptions, deps: ServiceDeps) => Promise<StartedService>

export const greetings = (greeting: string) =>
  router({
    greet: route('GET', '/hello/:name', (request) => {
      const message = `${greeting}, ${request.params.name}`
      return jsonResponse(200, { message })
    }),
  })

export const createService = (listen: Listen = startService) =>
  defineService({
    environment: defineEnvironment({
      http: { PORT: optional(asPort(), 8080) },
      hello: { HELLO_GREETING: required(asText()) },
    }),
    start: (values, context) => {
      const steps = [health(), greetings(values.hello.HELLO_GREETING)]
      return listen({ port: values.http.PORT, steps }, { report: context.report })
    },
  })
```

The main calls the function with no argument, `void runService(createService())`, and a spec passes a listener that opens nothing. All a listener has to resolve is a [`StartedService`](/docs/libraries/server#api-StartedService): an object with a `close()` function and, when it listens, a `port`. Do the same for anything else the start function opens, such as a connection pool. The route table is a function of its own so that step 9 can call it.

## 2. Build a fake process

The runner uses seven members of the process, the ones [`ServiceProcess`](/docs/libraries/server#api-ServiceProcess) lists: the environment, the platform name, the two output streams, `on`, `removeListener` and `exit`. An [`EventEmitter`](https://nodejs.org/api/events.html#class-eventemitter) brings the two listener functions, and lets a spec deliver a signal by emitting it. The imports are the ones the whole spec file needs:

```ts
// service.spec.ts
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import type { RunDeps, ServiceClock } from '@hyperfrontend/server'
import { runService } from '@hyperfrontend/server'
import type { Listen } from './service.js'
import { createService } from './service.js'

const output = () => {
  let text = ''
  const write = (chunk: string, done?: () => void): void => {
    text += chunk
    done?.()
  }
  return { write, text: () => text }
}

type Env = Record<string, string>

const fakeProcess = (env: Env) =>
  Object.assign(new EventEmitter(), {
    env,
    platform: 'linux',
    stdout: output(),
    stderr: output(),
    exit: (): void => undefined,
  })
```

A stream is a [`ProcessOutput`](/docs/libraries/server#api-ProcessOutput): one `write` function, which here keeps the text for the assertions. Call `done` whenever it is given. The runner ends a run when both streams have confirmed a last, empty write, and on a stream that never confirms it waits two seconds first. `exit` does nothing, which is what keeps a spec from ending the test runner; the next step shows where the code goes instead.

## 3. Run the definition over the fake

Pass the fake as [`process`](/docs/libraries/server#api-RunDeps-prop-process) and `null` as [`build`](/docs/libraries/server#api-RunDeps-prop-build). `null` says the service runs from source, so the runner reads no build stamp from the globals of the test process. `runService` returns a promise for the exit code, which resolves when the run has ended and never rejects:

```ts
const listening: Listen = async (options) => ({ port: options.port, close: async () => undefined })

const boot = (env: Env, listen: Listen = listening, deps: RunDeps = {}) => {
  const fake = fakeProcess(env)
  const code = runService(createService(listen), { process: fake, build: null, ...deps })
  return { fake, code }
}

const turn = () => new Promise((resolve) => setImmediate(resolve))
```

`listening` is the listener that opens nothing. `turn` waits one turn of the event loop, which is long enough for a start function to resolve when everything it awaits is in memory.

## 4. Assert a boot that is refused

Give the fake an environment the service cannot start with and await the code. The runner checks the [environment](/docs/libraries/server/environment#api-defineEnvironment) before it calls the start function, and refuses with [exit code 78](/docs/libraries/server/architecture#exit-codes) and one block on standard error:

```ts
test('refuses to boot on a wrong environment', async () => {
  const { fake, code } = boot({ PORT: 'eighty-eighty' })
  assert.equal(await code, 78)
  assert.equal(fake.stdout.text(), '')
  assert.match(fake.stderr.text(), /^fatal cause=environment\n/)
  assert.match(fake.stderr.text(), /HELLO_GREETING/)
  assert.match(fake.stderr.text(), /PORT/)
  assert.doesNotMatch(fake.stderr.text(), /eighty-eighty/)
})
```

The block those assertions read:

```text
fatal cause=environment
  - PORT (http) is malformed; expected an integer between 1 and 65535.
  - HELLO_GREETING (hello) is missing; expected non-empty text.
```

Compare the first line and look for the names; leave the sentences alone. The exit codes are the contract and the first line of a block has a [documented form](/docs/libraries/server/architecture#lines); the wording of the lines below it is written for people. The last assertion is worth having for every variable that holds something private: a block names the variable and what was expected of it, never the value it was given.

## 5. Assert the started line and a stop that was asked for

Wait for the start function to resolve, read the started line, then emit the signal on the fake and await the code:

```ts
test('starts, then stops with code 0 when it is asked to', async () => {
  const { fake, code } = boot({ HELLO_GREETING: 'Hello' })
  await turn()
  assert.equal(fake.stdout.text(), 'started port=8080\n')
  fake.emit('SIGTERM')
  assert.equal(await code, 0)
  assert.equal(fake.stdout.text(), 'started port=8080\nstopping cause=signal signal=SIGTERM\nstopped\n')
  assert.equal(fake.stderr.text(), '')
})
```

The `stopped` line is written when the `close()` of what the start function resolved has itself resolved, so the last comparison of standard output also proves the service was closed. Emit `disconnect` in place of the signal to test the [stop](/docs/libraries/server/architecture#causes-to-stop) a parent process asks for by closing the IPC channel: the line reads `stopping cause=disconnect` and the code is 0 again.

Stop every service a spec starts, and await its code. While a service runs, the runner keeps one timer pending so that an empty event loop cannot end the process, and that timer keeps a test process alive just as well: every test reports, and the command never returns.

## 6. Assert a start that fails

Make the injected listener fail the way the real one does. A start function that throws or rejects is exit code 1, a `start-failed` block and no started line:

```ts
test('exits 1 when the port is taken', async () => {
  const taken: Listen = async () => {
    const message = 'listen EADDRINUSE: address already in use :::8080'
    throw Object.assign(new Error(message), { code: 'EADDRINUSE' })
  }
  const { fake, code } = boot({ HELLO_GREETING: 'Hello' }, taken)
  assert.equal(await code, 1)
  assert.equal(fake.stdout.text(), '')
  assert.match(fake.stderr.text(), /^fatal cause=start-failed name=Error code=EADDRINUSE\n/)
})
```

The first line of the block carries the error's name and its `code`. Below it come the error's stack frames and, ahead of the started line only, [its message](/docs/libraries/server/architecture#what-is-printed-of-a-thrown-value), which is why the assertion matches the first line and stops there.

## 7. Assert a fault while the service runs

An unhandled rejection and an uncaught exception reach the runner as events of the process. Emit one on the fake once the service has started:

```ts
test('stops and exits 1 after a fault', async () => {
  const { fake, code } = boot({ HELLO_GREETING: 'Hello' })
  await turn()
  fake.emit('unhandledRejection', new Error('order 4411 could not be parsed'))
  assert.equal(await code, 1)
  assert.equal(fake.stdout.text(), 'started port=8080\nstopping cause=fault\nstopped\n')
  assert.match(fake.stderr.text(), /^fatal cause=unhandled-rejection name=Error\n/)
  assert.doesNotMatch(fake.stderr.text(), /4411/)
})
```

A fault begins a stop: the service is closed as it is for a signal, and the code is 1. Once the started line is out, a block carries the error's name and its stack frames and none of its message, since a message can quote a request; the last assertion pins that. Emit `uncaughtException` for the other kind of fault, which writes `fatal cause=uncaught-exception`.

## 8. Move time by hand where a timeout decides the outcome

Every timer of the runner is set through a [`ServiceClock`](/docs/libraries/server#api-ServiceClock): the [start timeout](/docs/libraries/server#api-ServiceDefinition-prop-startTimeoutMs), the timer it keeps pending while a service runs, the [stop timeout](/docs/libraries/server#api-ServiceDefinition-prop-stopTimeoutMs) and the two seconds it gives the streams. Pass a clock of your own as [`clock`](/docs/libraries/server#api-ClockDeps-prop-clock) and time moves only when the spec says so:

```ts
const fakeClock = () => {
  let now = 0
  let timers: { at: number; fire: () => void }[] = []
  const clock: ServiceClock = {
    now: () => now,
    setTimeout: (fire, ms) => {
      const timer = { at: now + ms, fire }
      timers.push(timer)
      return timer
    },
    clearTimeout: (handle) => {
      timers = timers.filter((timer) => timer !== handle)
    },
  }
  const advance = (ms: number): void => {
    now += ms
    const due = timers.filter((timer) => timer.at <= now)
    timers = timers.filter((timer) => timer.at > now)
    due.forEach((timer) => timer.fire())
  }
  return { clock, advance }
}

test('gives up on a start that never settles', async () => {
  const { clock, advance } = fakeClock()
  const never: Listen = () => new Promise(() => undefined)
  const { fake, code } = boot({ HELLO_GREETING: 'Hello' }, never, { clock })
  advance(30_000)
  assert.equal(fake.stdout.text(), 'stopping cause=start-timeout\n')
  advance(15_000)
  assert.equal(await code, 1)
  assert.equal(fake.stderr.text(), 'fatal cause=start-timeout\nfatal cause=stop-timeout\n')
})
```

A listener that never resolves runs out of the 30 seconds a start is given, is told to stop, and runs out of the 15 seconds a stop is given: 45 seconds of a real process, asserted in about a millisecond. A run on a clock of your own also leaves no timer pending in the test process, whether the spec stops its service or not.

## 9. Call the pipeline as a function

One level below the process, a [`Step`](/docs/libraries/server#api-Step) is a function of a request, a context and the rest of the pipeline. A spec calls it with three values and reads the response it returns. A [`ServiceRequest`](/docs/libraries/server#api-ServiceRequest) and a [`StepContext`](/docs/libraries/server#api-StepContext) are plain objects, and [`Next`](/docs/libraries/server#api-Next) is a function that resolves a response:

```ts
// greetings.spec.ts
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import type { Next, ServiceRequest, Step, StepContext } from '@hyperfrontend/server'
import { chain, health } from '@hyperfrontend/server'
import { greetings } from './service.js'

const context: StepContext = {
  signal: new AbortController().signal,
  client: { address: '192.0.2.1' },
  annotate: () => undefined,
  report: () => undefined,
}

const requestFor = (method: string, path: string): ServiceRequest => ({
  method,
  url: path,
  headers: {},
  path,
  query: new URLSearchParams(),
  params: {},
  body: {
    length: null,
    bytes: async () => Buffer.alloc(0),
    json: async () => null,
    stream: () => Readable.from([]),
  },
})

const unanswered: Next = async () => ({ status: 404, headers: {}, body: null })

const ask = async (step: Step, method: string, path: string) => {
  return step(requestFor(method, path), context, unanswered)
}
```

Write `path` decoded: a service [decodes the request target](/docs/libraries/server/architecture#the-request-target) before any step runs, and a step called directly gets the path as given. For a handler that reads a body, have `json` resolve the document it should receive. `ask` is an `async` function because a step may throw before it returns a promise, and a spec should receive both as a rejection.

```ts
test('greets by name', async () => {
  const response = await ask(greetings('Hello'), 'GET', '/hello/Ada')
  assert.equal(response.status, 200)
  assert.deepEqual(JSON.parse(String(response.body)), { message: 'Hello, Ada' })
})

test('refuses a method the route does not take', async () => {
  const refused = ask(greetings('Hello'), 'POST', '/hello/Ada')
  await assert.rejects(refused, { status: 405, code: 'method-not-allowed' })
})

test('answers a wrong method as a client sees it', async () => {
  const pipeline = chain(health(), greetings('Hello'))
  const response = await ask(pipeline, 'POST', '/hello/Ada')
  assert.equal(response.status, 405)
  assert.equal(response.headers['Allow'], 'GET, HEAD')
  assert.equal(String(response.body), 'Method Not Allowed')
})
```

A step called on its own throws its refusal, and the spec reads the status and the [code](/docs/libraries/server#api-HttpError-prop-code) of the [`HttpError`](/docs/libraries/server#api-HttpError): the code is what the request's log line names. To call several steps as one, compose them with [`chain`](/docs/libraries/server#api-chain): a refusal from any step behind the first then comes back as the response a client receives, with its status, headers and reason phrase.

## Check it worked

Compile, then run the two specs with Node's own runner:

```bash
node --test build/service.spec.js build/greetings.spec.js
```

```text
✔ greets by name (2.431711ms)
✔ refuses a method the route does not take (1.118348ms)
✔ answers a wrong method as a client sees it (0.996972ms)
✔ refuses to boot on a wrong environment (3.528729ms)
✔ starts, then stops with code 0 when it is asked to (8.548793ms)
✔ exits 1 when the port is taken (2.130418ms)
✔ stops and exits 1 after a fault (3.989229ms)
✔ gives up on a start that never settles (1.137053ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 159.27485
```

The command returns by itself with exit code 0, in a fraction of a second: no port was bound, no signal was sent, and the process the specs ran in was never asked to exit. If every test reports and the command hangs, a spec reached the started line and left its service running; stop it as step 5 does.

Then make the specs prove they watch the service. Change `listening` so that its `close()` rejects, and two specs fail: the stop that was asked for resolves 1 where 0 was expected, and the standard output of the fault ends without its `stopped` line.
