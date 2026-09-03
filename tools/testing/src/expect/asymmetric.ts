import { inspect } from 'node:util'

/**
 * Marks an object as an asymmetric matcher so `equals` consults it instead of comparing
 * it structurally. A registered symbol is used so a matcher created in one module realm
 * is still recognised in another.
 */
export const ASYMMETRIC = Symbol.for('hyperfrontend.testing.asymmetricMatcher')

/**
 * A stand-in value that decides for itself whether a received value matches it.
 */
export type AsymmetricMatcher = {
  /** Discriminator read by `equals`. */
  [ASYMMETRIC]: true
  /** Reports whether the received value satisfies this matcher. */
  asymmetricMatch(received: unknown): boolean
  /** Human-readable form used in failure messages. */
  toString(): string
}

/**
 * Reports whether a value is an asymmetric matcher.
 *
 * @param value - The value to test.
 * @returns True when the value decides its own equality.
 */
export function isAsymmetric(value: unknown): value is AsymmetricMatcher {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[ASYMMETRIC] === true
}

/**
 * Builds an asymmetric matcher with a label that renders in failure output.
 *
 * @param label - How the matcher describes itself.
 * @param matches - Predicate deciding whether a received value satisfies the matcher.
 * @returns The matcher, ready to be embedded in an expected value.
 */
export function createAsymmetric(label: string, matches: (received: unknown) => boolean): AsymmetricMatcher {
  return {
    [ASYMMETRIC]: true,
    asymmetricMatch: matches,
    toString: () => label,
    [inspect.custom]: () => label,
  } as AsymmetricMatcher
}

/**
 * Reports whether a value is an instance of, or a primitive matching, the given constructor.
 *
 * @param received - The value under test.
 * @param constructor - The constructor to match against.
 * @returns True when the value corresponds to that constructor.
 */
export function matchesConstructor(received: unknown, constructor: unknown): boolean {
  if (constructor === String) return typeof received === 'string' || received instanceof String
  if (constructor === Number) return typeof received === 'number' || received instanceof Number
  if (constructor === Boolean) return typeof received === 'boolean' || received instanceof Boolean
  if (constructor === BigInt) return typeof received === 'bigint'
  if (constructor === Symbol) return typeof received === 'symbol'
  if (constructor === Function) return typeof received === 'function'
  if (constructor === Object) return typeof received === 'object' && received !== null
  return typeof constructor === 'function' && received instanceof constructor
}
