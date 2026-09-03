import type { MatcherResult } from './matchers'
import { AssertionError } from 'node:assert'
import { matchesSubset } from './equality'
import { formatValue } from './format'
import { MATCHERS } from './matchers'

/**
 * What `toThrow` accepts as a description of the expected error.
 */
export type ThrowExpectation = string | RegExp | Error | (new (...args: any[]) => Error) | undefined

/**
 * The synchronous assertion surface. Matcher arguments are deliberately loose, mirroring
 * the typings the suites were written against, so a spec can pass an asymmetric matcher
 * anywhere a concrete value is expected.
 */
export type Assertions = {
  /** Asserts reference or primitive identity, like `Object.is`. */
  toBe(expected: unknown): void
  /** Asserts recursive structural equality, ignoring `undefined` properties. */
  toEqual(expected: unknown): void
  /** Asserts recursive equality including `undefined` properties and prototypes. */
  toStrictEqual(expected: unknown): void
  /** Asserts the value is not `undefined`. */
  toBeDefined(): void
  /** Asserts the value is `undefined`. */
  toBeUndefined(): void
  /** Asserts the value is `null`. */
  toBeNull(): void
  /** Asserts the value is `NaN`. */
  toBeNaN(): void
  /** Asserts the value is truthy. */
  toBeTruthy(): void
  /** Asserts the value is falsy. */
  toBeFalsy(): void
  /** Asserts the value is an instance of the given constructor. */
  toBeInstanceOf(expected: unknown): void
  /** Asserts the value is numerically greater than the expected value. */
  toBeGreaterThan(expected: number | bigint): void
  /** Asserts the value is numerically greater than or equal to the expected value. */
  toBeGreaterThanOrEqual(expected: number | bigint): void
  /** Asserts the value is numerically less than the expected value. */
  toBeLessThan(expected: number | bigint): void
  /** Asserts the value is numerically less than or equal to the expected value. */
  toBeLessThanOrEqual(expected: number | bigint): void
  /** Asserts the value is within `precision` decimal places of the expected value. */
  toBeCloseTo(expected: number, precision?: number): void
  /** Asserts the value's `length` equals the expected length. */
  toHaveLength(expected: number): void
  /** Asserts a string, array, Set, or Map contains the expected member by identity. */
  toContain(expected: unknown): void
  /** Asserts an iterable contains a member structurally equal to the expected value. */
  toContainEqual(expected: unknown): void
  /** Asserts a string matches the expected substring or pattern. */
  toMatch(expected: string | RegExp): void
  /** Asserts the value recursively covers the expected subset. */
  toMatchObject(expected: unknown): void
  /** Asserts a property path exists, optionally with the expected value. */
  toHaveProperty(path: string | readonly string[], value?: unknown): void
  /** Asserts the mock was called at least once. */
  toHaveBeenCalled(): void
  /** Asserts the mock was called exactly the expected number of times. */
  toHaveBeenCalledTimes(expected: number): void
  /** Asserts some call matched the expected arguments. */
  toHaveBeenCalledWith(...expected: unknown[]): void
  /** Asserts the most recent call matched the expected arguments. */
  toHaveBeenLastCalledWith(...expected: unknown[]): void
  /** Asserts the nth call, counting from one, matched the expected arguments. */
  toHaveBeenNthCalledWith(nth: number, ...expected: unknown[]): void
  /** Asserts the function throws, optionally matching a message, pattern, or error type. */
  toThrow(expected?: ThrowExpectation): void
  /** Alias of `toThrow`. */
  toThrowError(expected?: ThrowExpectation): void
}

/**
 * The asynchronous assertion surface produced by `.resolves` and `.rejects`.
 */
export type AsyncAssertions = {
  [Key in keyof Assertions]: (...args: Parameters<Assertions[Key]>) => Promise<void>
}

/**
 * The navigation an expectation offers on top of the matchers themselves.
 */
export type ExpectationModes = {
  /** Inverts every matcher reached through it. */
  not: Assertions & AsyncOnly
  /** Awaits the value, then asserts against what it resolved to. */
  resolves: AsyncAssertions & NegatedAsync
  /** Awaits the value, then asserts against what it rejected with. */
  rejects: AsyncAssertions & NegatedAsync
}

/**
 * A synchronous expectation, with its negated and promise-aware forms.
 */
export type Expectation = Assertions & ExpectationModes

/**
 * The promise-aware entry points still reachable after `.not`.
 */
export type AsyncOnly = {
  /** Awaits the value, then asserts against what it resolved to. */
  resolves: AsyncAssertions
  /** Awaits the value, then asserts against what it rejected with. */
  rejects: AsyncAssertions
}

/**
 * The negation still reachable after `.resolves` or `.rejects`.
 */
export type NegatedAsync = {
  /** Inverts every matcher reached through it. */
  not: AsyncAssertions
}

/**
 * How a promise-aware expectation unwraps its subject.
 */
type PromiseMode = 'resolves' | 'rejects' | null

/**
 * Raises a matcher failure as a Node assertion error, so reporters and IDEs treat it the
 * same as a `node:assert` failure.
 *
 * @param message - The rendered explanation.
 * @param received - The value under test.
 * @param expected - The value it was compared against.
 * @param operator - The matcher name, shown as the assertion operator.
 */
function raise(message: string, received: unknown, expected: unknown, operator: string): never {
  throw new AssertionError({ message, actual: received, expected, operator, stackStartFn: raise })
}

/**
 * Reports whether a thrown value satisfies the expectation passed to `toThrow`.
 *
 * @param thrown - The value that was thrown.
 * @param expected - The message, pattern, error type, or shape to match.
 * @returns True when the thrown value matches.
 */
function throwMatches(thrown: unknown, expected: ThrowExpectation): boolean {
  if (expected === undefined) return true

  const message = String((thrown as Error)?.message ?? thrown)
  if (typeof expected === 'string') return message.includes(expected)
  if (expected instanceof RegExp) return expected.test(message)
  if (expected instanceof Error) return message === expected.message
  if (typeof expected === 'function') return thrown instanceof expected
  return matchesSubset(thrown, expected)
}

/**
 * Counts assertions for `expect.assertions` and `expect.hasAssertions`.
 */
const counter = { seen: 0, required: null as number | null }

/**
 * Resets the assertion counter at the start of a test.
 */
export function resetAssertionCount(): void {
  counter.seen = 0
  counter.required = null
}

/**
 * Declares how many assertions the current test must run.
 *
 * @param count - The exact number expected, or `-1` to require at least one.
 */
export function requireAssertionCount(count: number): void {
  counter.required = count
}

/**
 * Verifies the assertion count declared by the current test, if any.
 */
export function verifyAssertionCount(): void {
  const { seen, required } = counter
  if (required === null) return
  if (required === -1) {
    if (seen === 0) raise('expected at least one assertion to run, none did', seen, 'at least one', 'hasAssertions')
    return
  }
  if (seen !== required) raise(`expected ${required} assertion(s) to run, ${seen} did`, seen, required, 'assertions')
}

/**
 * Applies a matcher, honouring negation and raising on failure.
 *
 * @param name - The matcher name, used as the assertion operator.
 * @param result - The matcher's verdict and message.
 * @param received - The value under test.
 * @param expected - The first matcher argument, recorded on the error.
 * @param negated - Whether the expectation was reached through `.not`.
 */
function settle(name: string, result: MatcherResult, received: unknown, expected: unknown, negated: boolean): void {
  counter.seen++
  if (result.pass !== negated) return
  raise(negated ? `NOT: ${result.message()}` : result.message(), received, expected, name)
}

/**
 * Builds the `toThrow` family, which needs the callable rather than its result.
 *
 * @param received - The value under test, expected to be a function.
 * @param negated - Whether the expectation was reached through `.not`.
 * @param name - Which alias was called, for the failure message.
 * @returns The matcher implementation.
 */
function buildThrow(received: unknown, negated: boolean, name: string): (expected?: ThrowExpectation) => void {
  return (expected) => {
    counter.seen++
    if (typeof received !== 'function')
      raise(`${name} needs a function to call, received ${formatValue(received)}`, received, 'a function', name)

    let threw = false
    let thrown: unknown
    try {
      received()
    } catch (error) {
      threw = true
      thrown = error
    }

    const pass = threw && throwMatches(thrown, expected)
    if (pass === negated) {
      const detail = threw ? `it threw ${formatValue(thrown)}` : 'it did not throw'
      raise(
        negated
          ? `expected the function not to throw ${formatValue(expected)}`
          : `expected the function to throw ${formatValue(expected)}, ${detail}`,
        thrown,
        expected,
        name
      )
    }
  }
}

/**
 * Unwraps the subject of a `.resolves` or `.rejects` expectation.
 *
 * @param subject - The promise under test.
 * @param mode - Whether the promise is expected to resolve or reject.
 * @returns The resolved value, or the rejection reason.
 */
async function unwrap(subject: unknown, mode: Exclude<PromiseMode, null>): Promise<unknown> {
  if (mode === 'resolves') return await subject

  try {
    await subject
  } catch (reason) {
    return reason
  }
  raise('expected the promise to reject, it resolved', subject, 'a rejection', 'rejects')
}

/**
 * Builds an expectation over a value.
 *
 * @param received - The value under test, or the promise to unwrap first.
 * @param negated - Whether matchers reached through this expectation are inverted.
 * @param mode - Whether the subject is a promise awaiting resolution or rejection.
 * @returns The assertion surface for that value.
 */
export function buildExpectation(received: unknown, negated: boolean, mode: PromiseMode): Expectation {
  const surface: Record<string, unknown> = {}

  for (const [name, matcher] of Object.entries(MATCHERS)) {
    surface[name] = mode
      ? async (...args: unknown[]): Promise<void> => {
          const value = await unwrap(received, mode)
          settle(name, matcher(value, ...args), value, args[0], negated)
        }
      : (...args: unknown[]): void => settle(name, matcher(received, ...args), received, args[0], negated)
  }

  for (const alias of ['toThrow', 'toThrowError']) {
    surface[alias] = mode
      ? async (expected?: ThrowExpectation): Promise<void> => {
          const value = await unwrap(received, mode)
          // why: after unwrapping a rejection the subject is the error itself, so `toThrow` compares it directly.
          settle(
            alias,
            { pass: throwMatches(value, expected), message: () => `expected ${formatValue(value)} to match ${formatValue(expected)}` },
            value,
            expected,
            negated
          )
        }
      : buildThrow(received, negated, alias)
  }

  Object.defineProperty(surface, 'not', { get: () => buildExpectation(received, !negated, mode) })
  if (mode === null) {
    Object.defineProperty(surface, 'resolves', { get: () => buildExpectation(received, negated, 'resolves') })
    Object.defineProperty(surface, 'rejects', { get: () => buildExpectation(received, negated, 'rejects') })
  }

  return surface as unknown as Expectation
}
