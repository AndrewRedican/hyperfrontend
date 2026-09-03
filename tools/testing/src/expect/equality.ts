import { isAsymmetric } from './asymmetric'

/**
 * How strictly two values must correspond.
 *
 * `structural` reproduces Jest's `toEqual`: `undefined`-valued own properties are ignored
 * and prototypes are not compared, so a class instance can equal a plain object.
 * `strict` reproduces `toStrictEqual`, where both of those differences are significant.
 */
export type EqualityMode = 'structural' | 'strict'

/**
 * Collects the own enumerable keys that participate in comparison.
 *
 * @param target - The object to read keys from.
 * @param mode - The equality mode deciding whether `undefined` values count.
 * @returns The string and symbol keys to compare.
 */
function comparableKeys(target: object, mode: EqualityMode): (string | symbol)[] {
  const record = target as Record<string | symbol, unknown>
  const keys: (string | symbol)[] = [
    ...Object.keys(record),
    ...Object.getOwnPropertySymbols(record).filter((symbol) => Object.prototype.propertyIsEnumerable.call(record, symbol)),
  ]
  return mode === 'strict' ? keys : keys.filter((key) => record[key] !== undefined)
}

/**
 * Compares two Maps, falling back to a structural search when a key is not identity-equal.
 *
 * @param received - The Map under test.
 * @param expected - The Map it is compared against.
 * @param mode - The equality mode to apply to keys and values.
 * @returns True when both Maps hold equal entries.
 */
function mapsEqual(received: Map<unknown, unknown>, expected: Map<unknown, unknown>, mode: EqualityMode): boolean {
  if (received.size !== expected.size) return false

  for (const [key, value] of received) {
    if (expected.has(key)) {
      if (!equals(value, expected.get(key), mode)) return false
      continue
    }
    // why: object keys are rarely identity-shared across a fixture boundary, so an equal-but-distinct key still counts.
    const paired = [...expected].some(([otherKey, otherValue]) => equals(key, otherKey, mode) && equals(value, otherValue, mode))
    if (!paired) return false
  }

  return true
}

/**
 * Compares two Sets, falling back to a structural search when a member is not identity-equal.
 *
 * @param received - The Set under test.
 * @param expected - The Set it is compared against.
 * @param mode - The equality mode to apply to members.
 * @returns True when both Sets hold equal members.
 */
function setsEqual(received: Set<unknown>, expected: Set<unknown>, mode: EqualityMode): boolean {
  if (received.size !== expected.size) return false

  for (const member of received) {
    if (expected.has(member)) continue
    if (![...expected].some((other) => equals(member, other, mode))) return false
  }

  return true
}

/**
 * The element-access view of a typed array, used to compare without narrowing to a
 * specific element type.
 */
type IndexedElements = Record<number, unknown> & Pick<ArrayLike<unknown>, 'length'>

/**
 * Compares two typed arrays or DataViews element by element.
 *
 * @param received - The view under test.
 * @param expected - The view it is compared against.
 * @returns True when both views share a prototype, a length, and every element.
 */
function viewsEqual(received: ArrayBufferView, expected: ArrayBufferView): boolean {
  if (Object.getPrototypeOf(received) !== Object.getPrototypeOf(expected)) return false
  const left = received as unknown as IndexedElements
  const right = expected as unknown as IndexedElements
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false
  }
  return true
}

/**
 * Compares two values the way Jest's `toEqual` and `toStrictEqual` do.
 *
 * Asymmetric matchers on either side decide the outcome themselves. Dates, regular
 * expressions, errors, Maps, Sets, and typed arrays are compared by their meaningful
 * contents rather than by enumerable properties.
 *
 * @param received - The value under test.
 * @param expected - The value it is compared against.
 * @param mode - Whether `undefined` properties and prototypes are significant.
 * @returns True when the two values are equal under the requested mode.
 */
export function equals(received: unknown, expected: unknown, mode: EqualityMode = 'structural'): boolean {
  if (isAsymmetric(expected)) return expected.asymmetricMatch(received)
  if (isAsymmetric(received)) return received.asymmetricMatch(expected)

  // why: Object.is separates NaN from itself correctly but also separates +0 from -0, which Jest treats as equal here.
  if (Object.is(received, expected)) return true
  if (typeof received === 'number' && typeof expected === 'number') return received === expected

  if (received === null || expected === null) return false
  if (typeof received !== 'object' || typeof expected !== 'object') return false

  if (Array.isArray(received) !== Array.isArray(expected)) return false
  if (received instanceof Date || expected instanceof Date) {
    return received instanceof Date && expected instanceof Date && received.getTime() === expected.getTime()
  }
  if (received instanceof RegExp || expected instanceof RegExp) {
    return (
      received instanceof RegExp && expected instanceof RegExp && received.source === expected.source && received.flags === expected.flags
    )
  }
  if (received instanceof Error || expected instanceof Error) {
    return (
      received instanceof Error && expected instanceof Error && received.name === expected.name && received.message === expected.message
    )
  }
  if (received instanceof Map && expected instanceof Map) return mapsEqual(received, expected, mode)
  if (received instanceof Set && expected instanceof Set) return setsEqual(received, expected, mode)
  if (ArrayBuffer.isView(received) && ArrayBuffer.isView(expected)) return viewsEqual(received, expected)

  if (mode === 'strict' && Object.getPrototypeOf(received) !== Object.getPrototypeOf(expected)) return false

  const receivedKeys = comparableKeys(received, mode)
  const expectedKeys = comparableKeys(expected, mode)
  if (receivedKeys.length !== expectedKeys.length) return false

  const left = received as Record<string | symbol, unknown>
  const right = expected as Record<string | symbol, unknown>
  for (const key of receivedKeys) {
    if (!expectedKeys.includes(key)) return false
    if (!equals(left[key], right[key], mode)) return false
  }

  return true
}

/**
 * Compares a value against a recursive subset the way Jest's `toMatchObject` does.
 *
 * Arrays must match in length and order; objects need only carry the expected keys.
 *
 * @param received - The value under test.
 * @param expected - The subset it must contain.
 * @returns True when the received value covers the expected subset.
 */
export function matchesSubset(received: unknown, expected: unknown): boolean {
  if (isAsymmetric(expected)) return expected.asymmetricMatch(received)

  if (Array.isArray(expected)) {
    if (!Array.isArray(received) || received.length !== expected.length) return false
    return expected.every((element, index) => matchesSubset(received[index], element))
  }

  const isPlainish =
    typeof expected === 'object' &&
    expected !== null &&
    !(expected instanceof Date) &&
    !(expected instanceof RegExp) &&
    !(expected instanceof Error)

  if (isPlainish) {
    if (typeof received !== 'object' || received === null) return false
    const left = received as Record<string | symbol, unknown>
    const right = expected as Record<string | symbol, unknown>
    return comparableKeys(expected, 'strict').every((key) => matchesSubset(left[key], right[key]))
  }

  return equals(received, expected)
}
