# process

Stand-ins for a process's terminal, standard streams and child processes, for testing command-line tools and interactive prompts.

## Usage

### Interactive prompts

[`createTtyInput`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-createTtyInput) returns a stdin that reports itself as a terminal and accepts raw mode. [`createCapturedOutput`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-createCapturedOutput) returns a stdout that keeps what it was given. [`Keys`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-Keys) holds the byte sequences a terminal sends for Enter, the arrows, Ctrl+C and the other keys prompts react to:

```typescript
import { expect, it } from '@hyperfrontend/testing'
import { Keys, createCapturedOutput, createTtyInput } from '@hyperfrontend/testing/process'
import { askName } from './ask-name'

it('answers with what was typed', async () => {
  const input = createTtyInput()
  const output = createCapturedOutput({ tty: true, columns: 60 })
  const answer = askName({ input, output })

  await input.sendKeys('a', 'd', 'a', Keys.Enter)

  expect(await answer).toBe('ada')
})
```

Keys arrive one per turn of the event loop, so the prompt handles and redraws after each one before the next arrives. Keys sent before anything listens are buffered rather than lost, and [`paste`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-TtyInput) sends text wrapped in bracketed-paste markers. As a terminal, the captured output reports a size, which [`resize`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-CapturedOutput) changes while emitting the event a real terminal emits, and a one-bit colour depth by default, so colour-aware code writes plain text that is easy to assert on.

### Standard streams

[`captureStdio`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-captureStdio) records what the process writes to stdout and stderr, console output included, and silences the real streams unless asked to pass writes through. The capture is a spy, so [`jest.restoreAllMocks`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) ends it as well as its own [`restore`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-CapturedStdio). Under `node --test`, a spec file reports its results to the runner as serialized messages on that same stdout; the capture recognises those and lets them through, so holding it across an `await` never drops a test from the report.

Code that takes its streams as arguments needs no capture: hand it a [`createCapturedOutput`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-createCapturedOutput), or read a `PassThrough` afterwards with [`readAll`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-readAll).

### Child processes

[`createFakeChildProcess`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-createFakeChildProcess) is what a mocked [`spawn`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) or [`fork`](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options) returns. The test writes its output and decides when, and how, it ends:

```typescript
import { spawn } from 'node:child_process'
import { expect, it, jest } from '@hyperfrontend/testing'
import { createFakeChildProcess } from '@hyperfrontend/testing/process'
import { runWorker } from './run-worker'

jest.mock('node:child_process', () => ({ spawn: jest.fn() }))

it('resolves with what the worker printed', async () => {
  const child = createFakeChildProcess()
  jest.mocked(spawn).mockReturnValue(child as never)

  const result = runWorker()
  child.writeStdout('{"ok":true}\n')
  child.exit(0)

  expect(await result).toEqual({ ok: true })
})
```

| Call                                     | Effect                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `exit(code, signal)`                     | Ends stdout and stderr, emits the exit event, then the close event on the next turn of the event loop |
| `kill(signal)`                           | Marks the child killed and exits it with the signal; reports false once it has exited                 |
| `fail(error)`                            | Emits the error event, as a child that could not start does                                           |
| `writeStdout(text)`, `writeStderr(text)` | Writes to the child's output streams                                                                  |

[`kill`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-FakeChildProcess-prop-kill) is a mock function, so a test can assert on the signals sent. [`spawnSyncResult`](https://www.hyperfrontend.dev/docs/libraries/testing/process/#api-spawnSyncResult) builds the complete object a mocked [`spawnSync`](https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options) returns, from only the fields that differ from a clean exit with no output.
