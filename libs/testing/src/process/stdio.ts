import { Serializer } from 'node:v8'
import { createSpy } from '../mock/spy'

/**
 * Which streams `captureStdio` takes over, and whether they still print.
 */
export type CaptureStdioOptions = {
  /** Capture stdout. Defaults to true. */
  stdout?: boolean
  /** Capture stderr. Defaults to true. */
  stderr?: boolean
  /** Still write to the real stream while recording. Defaults to false, which silences it. */
  passThrough?: boolean
}

/**
 * What the process wrote to its standard streams while captured.
 */
export type CapturedStdio = {
  /** Text written to stdout since capture began or was last cleared. */
  stdout(): string
  /** Text written to stderr since capture began or was last cleared. */
  stderr(): string
  /** Forgets what has been recorded so far. */
  clear(): void
  /** Hands the streams back. `jest.restoreAllMocks` does the same. */
  restore(): void
}

/**
 * The signature of a stream's `write`.
 */
type Write = (chunk: unknown, encoding?: unknown, callback?: unknown) => boolean

/**
 * The bytes every V8-serialized message starts with. A spec file running under `node --test`
 * reports each result to the parent process as such a message on its stdout, so a chunk
 * starting with these bytes belongs to the test runner, not to the code under test.
 */
const RUNNER_FRAME_HEADER = (() => {
  const serializer = new Serializer()
  serializer.writeHeader()
  return serializer.releaseBuffer()
})()

/**
 * Reports whether a written chunk is one of the test runner's own result messages.
 *
 * @param chunk - What was written.
 * @returns True for bytes that open with the V8 serialization header.
 */
function isRunnerFrame(chunk: unknown): boolean {
  return (
    chunk instanceof Uint8Array &&
    chunk.length >= RUNNER_FRAME_HEADER.length &&
    RUNNER_FRAME_HEADER.every((byte, index) => chunk[index] === byte)
  )
}

/**
 * Takes over one stream's `write`, recording what passes through it.
 *
 * @param stream - The stream to take over.
 * @param record - Receives every chunk as text.
 * @param passThrough - Whether the real stream still receives the write.
 * @returns The restore function for the takeover.
 */
function takeOver(stream: NodeJS.WriteStream, record: (text: string) => void, passThrough: boolean): () => void {
  const original = stream.write.bind(stream) as Write
  const spy = createSpy(stream, 'write').mockImplementation(((chunk, encoding, callback) => {
    // why: the runner flushes earlier tests' results whenever the event loop turns, and swallowing them would drop those tests from the report.
    if (isRunnerFrame(chunk)) return original(chunk, encoding, callback)
    record(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8'))
    if (passThrough) return original(chunk, encoding, callback)
    const done = typeof encoding === 'function' ? encoding : callback
    // why: a real write reports completion asynchronously, and code awaiting the callback must not resume inside its own write call.
    if (typeof done === 'function') process.nextTick(done as () => void)
    return true
  }) as Write)
  return () => spy.mockRestore()
}

/**
 * Records what the process writes to stdout and stderr, silencing the real streams unless
 * told to pass the writes through.
 *
 * `console` writes through the same streams, so its output is captured too. The takeover
 * is a spy, so `jest.restoreAllMocks` and the runner's `restoreMocks` option end it as well
 * as `restore`. The test runner's own result messages, which share stdout with the code
 * under test, are recognised and passed through, so a capture held across an `await` never
 * drops a test from the report.
 *
 * @param options - Which streams to capture, and whether they still print.
 * @returns Readers for what was written, and a restore.
 * @example Asserting on a warning without printing it
 * ```ts
 * const stdio = captureStdio()
 * build({ strict: false })
 * stdio.restore()
 * expect(stdio.stderr()).toContain('strict mode is off')
 * ```
 */
export function captureStdio(options: CaptureStdioOptions = {}): CapturedStdio {
  const recorded = { stdout: '', stderr: '' }
  const passThrough = options.passThrough ?? false
  const restores = [
    ...(options.stdout === false ? [] : [takeOver(process.stdout, (text) => (recorded.stdout += text), passThrough)]),
    ...(options.stderr === false ? [] : [takeOver(process.stderr, (text) => (recorded.stderr += text), passThrough)]),
  ]
  return {
    stdout: () => recorded.stdout,
    stderr: () => recorded.stderr,
    clear: () => {
      recorded.stdout = ''
      recorded.stderr = ''
    },
    restore: () => {
      for (const restore of restores) restore()
    },
  }
}
