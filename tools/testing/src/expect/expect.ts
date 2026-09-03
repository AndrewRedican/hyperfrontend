import type { AsymmetricMatcher } from './asymmetric'
import type { Expectation } from './expectation'
import { createAsymmetric, matchesConstructor } from './asymmetric'
import { equals } from './equality'
import { buildExpectation, requireAssertionCount } from './expectation'
import { describeConstructor, formatValue } from './format'

/**
 * The asymmetric matcher constructors reachable under `expect.not`.
 */
export type NegatedAsymmetrics = {
  /** Matches an object that does not carry the sample's properties. */
  objectContaining(sample: Record<string, unknown>): AsymmetricMatcher
  /** Matches an array that does not contain every sample member. */
  arrayContaining(sample: readonly unknown[]): AsymmetricMatcher
  /** Matches a string that does not contain the substring. */
  stringContaining(sample: string): AsymmetricMatcher
  /** Matches a string that does not match the pattern. */
  stringMatching(sample: string | RegExp): AsymmetricMatcher
}

/**
 * The callable `expect`, with the asymmetric matcher constructors and assertion-count
 * declarations Jest exposes as statics.
 */
export type ExpectApi = {
  (received: unknown): Expectation
  /** Matches any value produced by the given constructor. */
  any(constructor: unknown): AsymmetricMatcher
  /** Matches any value that is neither null nor undefined. */
  anything(): AsymmetricMatcher
  /** Matches an object carrying at least the sample's properties. */
  objectContaining(sample: Record<string, unknown>): AsymmetricMatcher
  /** Matches an array containing every sample member, in any position. */
  arrayContaining(sample: readonly unknown[]): AsymmetricMatcher
  /** Matches a string containing the substring. */
  stringContaining(sample: string): AsymmetricMatcher
  /** Matches a string matching the pattern. */
  stringMatching(sample: string | RegExp): AsymmetricMatcher
  /** Matches a number within `precision` decimal places of the sample. */
  closeTo(sample: number, precision?: number): AsymmetricMatcher
  /** The negated asymmetric matcher constructors. */
  not: NegatedAsymmetrics
  /** Declares the exact number of assertions the current test must run. */
  assertions(count: number): void
  /** Declares that the current test must run at least one assertion. */
  hasAssertions(): void
}

/**
 * Wraps a value in an assertion surface.
 *
 * @param received - The value under test.
 * @returns The matchers applicable to that value.
 */
function expectValue(received: unknown): Expectation {
  return buildExpectation(received, false, null)
}

const objectContaining = (sample: Record<string, unknown>): AsymmetricMatcher =>
  createAsymmetric(
    `ObjectContaining(${formatValue(sample)})`,
    (received) =>
      typeof received === 'object' &&
      received !== null &&
      Object.keys(sample).every((key) => key in received && equals((received as Record<string, unknown>)[key], sample[key]))
  )

const arrayContaining = (sample: readonly unknown[]): AsymmetricMatcher =>
  createAsymmetric(
    `ArrayContaining(${formatValue(sample)})`,
    (received) => Array.isArray(received) && sample.every((wanted) => received.some((element) => equals(element, wanted)))
  )

const stringContaining = (sample: string): AsymmetricMatcher =>
  createAsymmetric(`StringContaining(${formatValue(sample)})`, (received) => typeof received === 'string' && received.includes(sample))

const stringMatching = (sample: string | RegExp): AsymmetricMatcher =>
  createAsymmetric(
    `StringMatching(${formatValue(sample)})`,
    (received) => typeof received === 'string' && (sample instanceof RegExp ? sample.test(received) : received.includes(sample))
  )

/**
 * Inverts an asymmetric matcher constructor.
 *
 * @param build - The constructor to invert.
 * @param label - How the inverted matcher describes itself.
 * @returns A constructor producing the negated matcher.
 */
function negate<TSample>(build: (sample: TSample) => AsymmetricMatcher, label: string): (sample: TSample) => AsymmetricMatcher {
  return (sample) => createAsymmetric(`Not${label}(${formatValue(sample)})`, (received) => !build(sample).asymmetricMatch(received))
}

/**
 * The workspace's `expect`, matching the Jest surface the suites were written against.
 */
export const expect: ExpectApi = Object.assign(expectValue, {
  any: (constructor: unknown): AsymmetricMatcher =>
    createAsymmetric(`Any(${describeConstructor(constructor)})`, (received) => matchesConstructor(received, constructor)),
  anything: (): AsymmetricMatcher => createAsymmetric('Anything', (received) => received !== null && received !== undefined),
  objectContaining,
  arrayContaining,
  stringContaining,
  stringMatching,
  closeTo: (sample: number, precision = 2): AsymmetricMatcher =>
    createAsymmetric(
      `CloseTo(${sample})`,
      (received) => typeof received === 'number' && Math.abs(received - sample) < Math.pow(10, -precision) / 2
    ),
  not: {
    objectContaining: negate(objectContaining, 'ObjectContaining'),
    arrayContaining: negate(arrayContaining, 'ArrayContaining'),
    stringContaining: negate(stringContaining, 'StringContaining'),
    stringMatching: negate(stringMatching, 'StringMatching'),
  },
  assertions: (count: number): void => requireAssertionCount(count),
  hasAssertions: (): void => requireAssertionCount(-1),
})
