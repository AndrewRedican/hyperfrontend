import type { MockFn } from '../mock/types'
import { isMockFunction } from '../mock/types'
import { equals, matchesSubset } from './equality'
import { describeConstructor, formatArguments, formatValue } from './format'

/**
 * The verdict a matcher returns, plus the message shown when the assertion fails.
 *
 * `message` describes the *positive* expectation. The negated form is derived from it, so
 * a matcher never has to phrase both directions.
 */
export type MatcherResult = {
  /** Whether the received value satisfied the matcher. */
  pass: boolean
  /** Describes the positive expectation, evaluated only on failure. */
  message: () => string
}

/**
 * A matcher implementation, invoked with the received value followed by the call arguments.
 */
export type MatcherFn = (received: any, ...args: any[]) => MatcherResult

/**
 * Reads the call history off a value, failing loudly when it is not a mock.
 *
 * @param received - The value a call matcher was applied to.
 * @returns The recorded calls, oldest first.
 */
function callsOf(received: unknown): unknown[][] {
  if (!isMockFunction(received)) {
    throw new TypeError(`Expected a mock function created by jest.fn() or jest.spyOn(), received ${formatValue(received)}`)
  }
  return (received as MockFn).mock.calls
}

/**
 * Renders every recorded call so a failed call assertion shows what did happen.
 *
 * @param calls - The recorded calls.
 * @returns One rendered call per line, or a note that there were none.
 */
function formatCalls(calls: readonly unknown[][]): string {
  if (calls.length === 0) return 'it was never called'
  return `received calls:\n${calls.map((args, index) => `  ${index + 1}. ${formatArguments(args)}`).join('\n')}`
}

/**
 * The outcome of walking a property path.
 */
type PathLookup = {
  /** Whether every segment of the path existed. */
  found: boolean
  /** The value at the end of the path, when it resolved. */
  value: unknown
}

/**
 * Resolves a property path, reporting whether every segment existed.
 *
 * @param target - The object to walk.
 * @param path - A dotted string or an array of keys.
 * @returns Whether the path resolved, and the value found at it.
 */
function readPath(target: unknown, path: string | readonly string[]): PathLookup {
  const segments = Array.isArray(path) ? path : String(path).split('.')
  let current = target

  for (const segment of segments) {
    if (current === null || current === undefined) return { found: false, value: undefined }
    if (!(segment in Object(current))) return { found: false, value: undefined }
    current = (current as Record<string, unknown>)[segment]
  }

  return { found: true, value: current }
}

/**
 * Every matcher this runtime supports, keyed by the name specs call it under.
 *
 * The set is deliberately closed: it covers the matchers the workspace's suites actually
 * use. Adding one here is preferable to reaching for a raw assertion in a spec.
 */
export const MATCHERS: Record<string, MatcherFn> = {
  toBe: (received, expected) => ({
    pass: Object.is(received, expected),
    message: () => `expected ${formatValue(received)} to be ${formatValue(expected)} (same reference or value)`,
  }),
  toEqual: (received, expected) => ({
    pass: equals(received, expected, 'structural'),
    message: () => `expected ${formatValue(received)} to equal ${formatValue(expected)}`,
  }),
  toStrictEqual: (received, expected) => ({
    pass: equals(received, expected, 'strict'),
    message: () => `expected ${formatValue(received)} to strictly equal ${formatValue(expected)}`,
  }),
  toBeDefined: (received) => ({
    pass: received !== undefined,
    message: () => `expected ${formatValue(received)} to be defined`,
  }),
  toBeUndefined: (received) => ({
    pass: received === undefined,
    message: () => `expected ${formatValue(received)} to be undefined`,
  }),
  toBeNull: (received) => ({
    pass: received === null,
    message: () => `expected ${formatValue(received)} to be null`,
  }),
  toBeNaN: (received) => ({
    pass: Number.isNaN(received),
    message: () => `expected ${formatValue(received)} to be NaN`,
  }),
  toBeTruthy: (received) => ({
    pass: Boolean(received),
    message: () => `expected ${formatValue(received)} to be truthy`,
  }),
  toBeFalsy: (received) => ({
    pass: !received,
    message: () => `expected ${formatValue(received)} to be falsy`,
  }),
  toBeInstanceOf: (received, constructor) => ({
    pass: typeof constructor === 'function' && received instanceof constructor,
    message: () => `expected ${formatValue(received)} to be an instance of ${describeConstructor(constructor)}`,
  }),
  toBeGreaterThan: (received, expected) => ({
    pass: received > expected,
    message: () => `expected ${formatValue(received)} to be greater than ${formatValue(expected)}`,
  }),
  toBeGreaterThanOrEqual: (received, expected) => ({
    pass: received >= expected,
    message: () => `expected ${formatValue(received)} to be greater than or equal to ${formatValue(expected)}`,
  }),
  toBeLessThan: (received, expected) => ({
    pass: received < expected,
    message: () => `expected ${formatValue(received)} to be less than ${formatValue(expected)}`,
  }),
  toBeLessThanOrEqual: (received, expected) => ({
    pass: received <= expected,
    message: () => `expected ${formatValue(received)} to be less than or equal to ${formatValue(expected)}`,
  }),
  toBeCloseTo: (received, expected, precision = 2) => ({
    pass: Math.abs(received - expected) < Math.pow(10, -precision) / 2,
    message: () => `expected ${formatValue(received)} to be within ${precision} decimal places of ${formatValue(expected)}`,
  }),
  toHaveLength: (received, expected) => ({
    pass: received !== null && received !== undefined && received.length === expected,
    message: () => `expected ${formatValue(received)} to have length ${formatValue(expected)}, found ${formatValue(received?.length)}`,
  }),
  toContain: (received, expected) => {
    const pass =
      typeof received === 'string'
        ? received.includes(expected)
        : received instanceof Set || received instanceof Map
          ? received.has(expected)
          : [...(received ?? [])].some((element) => Object.is(element, expected))
    return { pass, message: () => `expected ${formatValue(received)} to contain ${formatValue(expected)}` }
  },
  toContainEqual: (received, expected) => ({
    pass: [...(received ?? [])].some((element) => equals(element, expected)),
    message: () => `expected ${formatValue(received)} to contain an element equal to ${formatValue(expected)}`,
  }),
  toMatch: (received, expected) => ({
    pass: expected instanceof RegExp ? expected.test(received) : String(received).includes(expected),
    message: () => `expected ${formatValue(received)} to match ${formatValue(expected)}`,
  }),
  toMatchObject: (received, expected) => ({
    pass: matchesSubset(received, expected),
    message: () => `expected ${formatValue(received)} to match the object ${formatValue(expected)}`,
  }),
  toHaveProperty: (received, path, ...rest) => {
    const { found, value } = readPath(received, path)
    if (!found) {
      return { pass: false, message: () => `expected ${formatValue(received)} to have the property ${formatValue(path)}` }
    }
    if (rest.length === 0) {
      return { pass: true, message: () => `expected ${formatValue(received)} to have the property ${formatValue(path)}` }
    }
    return {
      pass: equals(value, rest[0]),
      message: () => `expected the property ${formatValue(path)} to equal ${formatValue(rest[0])}, found ${formatValue(value)}`,
    }
  },
  toHaveBeenCalled: (received) => {
    const calls = callsOf(received)
    return { pass: calls.length > 0, message: () => 'expected the mock to have been called' }
  },
  toHaveBeenCalledTimes: (received, expected) => {
    const calls = callsOf(received)
    return {
      pass: calls.length === expected,
      message: () => `expected the mock to have been called ${formatValue(expected)} time(s), it was called ${calls.length} time(s)`,
    }
  },
  toHaveBeenCalledWith: (received, ...expected) => {
    const calls = callsOf(received)
    return {
      pass: calls.some((args) => equals(args, expected)),
      message: () => `expected the mock to have been called with ${formatArguments(expected)}; ${formatCalls(calls)}`,
    }
  },
  toHaveBeenLastCalledWith: (received, ...expected) => {
    const calls = callsOf(received)
    const last = calls.at(-1)
    return {
      pass: calls.length > 0 && equals(last, expected),
      message: () => `expected the last call to be ${formatArguments(expected)}; ${formatCalls(calls)}`,
    }
  },
  toHaveBeenNthCalledWith: (received, nth, ...expected) => {
    const calls = callsOf(received)
    return {
      pass: calls.length >= nth && equals(calls[nth - 1], expected),
      message: () => `expected call ${formatValue(nth)} to be ${formatArguments(expected)}; ${formatCalls(calls)}`,
    }
  },
}
