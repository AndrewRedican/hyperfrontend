import type { EnvironmentIssue } from '../environment/contract'
import { errorName } from './events'

/** Why a service is being stopped, as the stopping line names it. */
export type StopCause = 'signal' | 'disconnect' | 'fault' | 'start-timeout'

/** What ended a boot, a run or a stop badly, as a fatal block names it. */
export type FatalCause =
  | 'definition'
  | 'release'
  | 'immutable'
  | 'environment'
  | 'start-failed'
  | 'start-timeout'
  | 'uncaught-exception'
  | 'unhandled-rejection'
  | 'stop-failed'
  | 'stop-timeout'
  | 'forced'

/** The fields a fatal line may carry after its cause. */
export interface FatalFields {
  /** The thrown error's name, or `unknown`. */
  readonly name?: string
  /** The thrown error's code, when it has one that is safe to print. */
  readonly code?: string
  /** The signal that forced the stop. */
  readonly signal?: string
}

/** The line that says `close()` resolved. */
export const STOPPED_LINE = 'stopped\n'

/** The detail of the fatal block for a start function that resolved to something the runner cannot stop. */
export const UNUSABLE_START =
  'the start function must resolve to an object with a close() function and, when it has a port, an integer from 1 to 65535.'

/** The sentence of the fatal block for a built service that runs with another immutable section than it was built with. */
export const SECTION_DIFFERS = 'the immutable section this service runs with is not the one it was built with.'

// note: How many stack frames one fault prints.
const FRAME_LIMIT = 12

// note: An error code that may reach a log: the upper-case form the platform and its libraries use, of at most 64 characters.
const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/

// note: A stack line that names a call site, whatever it was indented with.
const FRAME_LINE = /^\s+at /

/**
 * Writes the line that says the start function resolved.
 *
 * @param port - The port the service listens on, or `undefined` for a service with no listener.
 * @param release - The digest of the release manifest of a built service, or `null` for a service run from source.
 * @returns The word `started`, then the port, then the release, closed by a line feed.
 *
 * @example The three forms of the line
 * ```typescript
 * startedLine(8080, '6a602df9bd1d576e02e0b7fbd8a523e3e701da9879879b985f52fcb76f9b6c13')
 * // => 'started port=8080 release=6a602df9bd1d576e02e0b7fbd8a523e3e701da9879879b985f52fcb76f9b6c13\n'
 * startedLine(8080, null) // => 'started port=8080\n'
 * startedLine(undefined, null) // => 'started\n'
 * ```
 */
export function startedLine(port: number | undefined, release: string | null): string {
  return `started${port === undefined ? '' : ` port=${port}`}${release === null ? '' : ` release=${release}`}\n`
}

/**
 * Writes the line that says a stop began, and why.
 *
 * @param cause - What asked for the stop.
 * @param signal - Which one, when a signal did.
 * @returns The line, closed by a line feed.
 *
 * @example A stop asked for by a supervisor, and one after a fault
 * ```typescript
 * stoppingLine('signal', 'SIGTERM') // => 'stopping cause=signal signal=SIGTERM\n'
 * stoppingLine('fault') // => 'stopping cause=fault\n'
 * ```
 */
export function stoppingLine(cause: StopCause, signal?: string): string {
  return `stopping cause=${cause}${signal === undefined ? '' : ` signal=${signal}`}\n`
}

/**
 * Writes a fatal block: one line that names the cause, then its detail lines. The block is one text so that it reaches a stream in one write.
 *
 * @param cause - What went wrong.
 * @param fields - The name, code and signal that go with the cause; a member left out is not written.
 * @param detail - The lines below the first, each already indented as it is to be read.
 * @returns The block, every line closed by a line feed.
 *
 * @example A start that could not bind its port
 * ```typescript
 * fatalBlock('start-failed', { name: 'Error', code: 'EADDRINUSE' }, ['    at Server.listen (node:net:1:1)'])
 * // => 'fatal cause=start-failed name=Error code=EADDRINUSE\n    at Server.listen (node:net:1:1)\n'
 * ```
 */
export function fatalBlock(cause: FatalCause, fields: FatalFields, detail: readonly string[]): string {
  const head = [
    `fatal cause=${cause}`,
    ...(fields.name === undefined ? [] : [`name=${fields.name}`]),
    ...(fields.code === undefined ? [] : [`code=${fields.code}`]),
    ...(fields.signal === undefined ? [] : [`signal=${fields.signal}`]),
  ].join(' ')
  return `${[head, ...detail].join('\n')}\n`
}

/**
 * Reads the code of a thrown value, when it is one that may be printed.
 *
 * @param value - Whatever was thrown.
 * @returns The `code` of an `Error` when it is a short upper-case word, else `null`; it never throws.
 */
function errorCode(value: unknown): string | null {
  try {
    if (value instanceof Error) {
      const code: unknown = (value as NodeJS.ErrnoException).code
      return typeof code === 'string' && ERROR_CODE.test(code) ? code : null
    }
  } catch {
    // why: a getter or a proxy trap may throw while the value is read, and a fault must still be reported
  }
  return null
}

/**
 * Describes a thrown value by what is safe to print of it: its name, and its code when it has one.
 *
 * @param value - Whatever was thrown or rejected with.
 * @returns The fields for a fatal line. A value that is no `Error` is named `unknown` and gives nothing of itself.
 *
 * @example A bind error and a thrown string
 * ```typescript
 * faultFields(Object.assign(new Error('listen EADDRINUSE: address already in use :::8080'), { code: 'EADDRINUSE' }))
 * // => { name: 'Error', code: 'EADDRINUSE' }
 * faultFields('a thrown string') // => { name: 'unknown' }
 * ```
 */
export function faultFields(value: unknown): FatalFields {
  const code = errorCode(value)
  return code === null ? { name: errorName(value) } : { name: errorName(value), code }
}

/**
 * Tells whether a header may end at an index of a stack: only a line feed or the end of the text may follow it.
 *
 * @param stack - The stack text of an error.
 * @param end - The index right after the candidate header.
 * @returns `true` when nothing of the header's line is left at the index.
 */
function endsLine(stack: string, end: number): boolean {
  return end === stack.length || stack.startsWith('\n', end)
}

/**
 * Cuts the header off a stack. The header holds the message, whose own lines can look like frames, so it is located by the message and removed, never skipped by pattern.
 *
 * @param stack - The stack text of an error.
 * @param message - The message of the same error.
 * @returns What follows the header, or `null` when the stack does not hold the message where a header holds it.
 */
function afterHeader(stack: string, message: string): string | null {
  if (message === '') {
    const feed = stack.indexOf('\n')
    return feed === -1 ? '' : stack.slice(feed)
  }
  // how: a header is the message alone, or a name and a colon ahead of it, so the message opens the stack or follows its first such colon
  if (stack.startsWith(message) && endsLine(stack, message.length)) {
    return stack.slice(message.length)
  }
  const marked = stack.indexOf(`: ${message}`)
  const end = marked + 2 + message.length
  return marked === -1 || stack.slice(0, marked).includes('\n') || !endsLine(stack, end) ? null : stack.slice(end)
}

/**
 * Lists the call sites of a thrown error, without one character of its message.
 *
 * @param value - Whatever was thrown or rejected with.
 * @returns At most twelve frames, each trimmed and indented by four spaces. None for a value that is no `Error`, for an error whose stack or message is not text or cannot be read, and for a stack whose header cannot be located.
 *
 * @example A message whose second line is shaped like a frame
 * ```typescript
 * stackFrames(new Error('could not parse\n    at the-request-body (evil:1:1)'))
 * // => ['    at handle (file:///app/main.js:12:9)', ...] and no line of the message
 * ```
 */
export function stackFrames(value: unknown): readonly string[] {
  let stack: unknown
  let message: unknown
  try {
    if (!(value instanceof Error)) {
      return []
    }
    stack = value.stack
    message = value.message
  } catch {
    return []
  }
  const rest = typeof stack === 'string' && typeof message === 'string' ? afterHeader(stack, message) : null
  return rest === null
    ? []
    : rest
        .split(/\r?\n/)
        .filter((line) => FRAME_LINE.test(line))
        .slice(0, FRAME_LIMIT)
        .map((line) => `    ${line.trim()}`)
}

/**
 * Gives the message of an error that ended a boot, for the fatal block written ahead of the started line.
 *
 * @param value - Whatever the boot failed with.
 * @returns The non-empty message of an `Error` as it is, as one detail; nothing for any other value.
 *
 * @example An options error and a thrown string
 * ```typescript
 * bootMessage(new Error('Invalid service options:\n  - "port" must be an integer between 0 and 65535.'))
 * // => ['Invalid service options:\n  - "port" must be an integer between 0 and 65535.']
 * bootMessage('a thrown string') // => []
 * ```
 */
export function bootMessage(value: unknown): readonly string[] {
  try {
    if (value instanceof Error) {
      const message: unknown = value.message
      return typeof message === 'string' && message !== '' ? [message] : []
    }
  } catch {
    // why: a getter or a proxy trap may throw while the value is read, and the block is written without the message then
  }
  return []
}

/**
 * Writes sentences as the list items of a fatal block.
 *
 * @param sentences - One sentence per problem.
 * @returns Each sentence behind two spaces, a hyphen and a space.
 *
 * @example The problems of a definition
 * ```typescript
 * listLines(['"start" must be a function.']) // => ['  - "start" must be a function.']
 * ```
 */
export function listLines(sentences: readonly string[]): readonly string[] {
  return sentences.map((sentence) => `  - ${sentence}`)
}

/**
 * Writes the issues of an environment as the list items of a fatal block. An issue carries no value, so none can reach a line.
 *
 * @param issues - What the contract found, in declaration order.
 * @returns One line per issue: the variable, its group, the problem and what was expected.
 *
 * @example A variable that is not set
 * ```typescript
 * issueLines([{ name: 'HELLO_GREETING', group: 'hello', problem: 'missing', expected: 'non-empty text' }])
 * // => ['  - HELLO_GREETING (hello) is missing; expected non-empty text.']
 * ```
 */
export function issueLines(issues: readonly EnvironmentIssue[]): readonly string[] {
  return listLines(issues.map((issue) => `${issue.name} (${issue.group}) is ${issue.problem}; expected ${issue.expected}.`))
}

/** How many detail lines one release block prints before it says how many more there are. */
export const RELEASE_LINE_LIMIT = 32

/**
 * Bounds the detail lines of a release block, which a manifest or a directory anyone may have written decides the number of.
 *
 * @param lines - The detail lines, as they are to be written.
 * @returns The same lines when they fit the limit, else the first of them up to the limit and one list item that counts the rest.
 *
 * @example A block of forty lines
 * ```typescript
 * boundedLines(Array.from({ length: 40 }, (_, index) => `  - file${index} is present but not listed.`)).at(-1)
 * // => '  - and 8 more.'
 * ```
 */
export function boundedLines(lines: readonly string[]): readonly string[] {
  return lines.length <= RELEASE_LINE_LIMIT
    ? lines
    : [...lines.slice(0, RELEASE_LINE_LIMIT), `  - and ${lines.length - RELEASE_LINE_LIMIT} more.`]
}
