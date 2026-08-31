import { scrubLiterals } from './scrub.ts'

/**
 * One `jest.mock` call found in a spec.
 */
export type MockDeclaration = {
  /** The specifier as written, still relative to the spec file. */
  specifier: string
  /** Source text of the factory, or undefined for the automock form with no factory. */
  factory: string | undefined
  /** Property names the factory's object literal defines. */
  overrides: string[]
  /** Whether the factory spreads a value, meaning unnamed exports must still pass through. */
  spreads: boolean
}

const CALL = 'jest.mock('

/**
 * A declaration and where the call that produced it ended.
 */
type ReadResult = {
  /** The declaration that was read. */
  value: MockDeclaration
  /** Index just past the call's closing parenthesis. */
  end: number
}

/**
 * Finds every `jest.mock` call in a spec file.
 *
 * A spec's `load` hook runs before any of its imports are resolved, so declarations read
 * here are registered in time to replace the modules the spec is about to pull in. That
 * ordering is what lets the suites keep `jest.mock` exactly as written.
 *
 * @param source - The spec file's text.
 * @returns One entry per call, in source order.
 */
export function readMockDeclarations(source: string): MockDeclaration[] {
  const scrubbed = scrubLiterals(source)
  const found: MockDeclaration[] = []
  let at = scrubbed.indexOf(CALL)

  while (at !== -1) {
    const declaration = readOne(source, scrubbed, at)
    if (declaration) found.push(declaration.value)
    at = scrubbed.indexOf(CALL, declaration ? declaration.end : at + CALL.length)
  }

  return found
}

/**
 * Reads the single call beginning at `at`.
 *
 * @param source - The spec file's text.
 * @param scrubbed - The same text with literals and comments blanked.
 * @param at - Index of the `jest.mock(` token.
 * @returns The declaration and the index just past it, or undefined when the call is malformed.
 */
function readOne(source: string, scrubbed: string, at: number): ReadResult | undefined {
  let index = at + CALL.length
  while (index < source.length && /\s/.test(source[index] ?? '')) index += 1

  const quote = source[index]
  if (quote !== "'" && quote !== '"') return undefined
  const closing = source.indexOf(quote, index + 1)
  if (closing === -1) return undefined
  const specifier = source.slice(index + 1, closing)

  index = closing + 1
  while (index < source.length && /[\s,]/.test(source[index] ?? '')) index += 1

  if (source[index] === ')') {
    return { value: { specifier, factory: undefined, overrides: [], spreads: false }, end: index + 1 }
  }

  const end = matchingClose(scrubbed, index)
  const factory = source.slice(index, end).trim()
  return {
    value: { specifier, factory, overrides: objectKeys(scrubbed.slice(index, end)), spreads: scrubbed.slice(index, end).includes('...') },
    end: end + 1,
  }
}

/**
 * Walks forward to the `)` that closes the `jest.mock` call.
 *
 * @param scrubbed - Source with literals blanked, so brackets inside strings cannot mislead.
 * @param from - Index of the first character of the factory.
 * @returns Index of the closing parenthesis.
 */
function matchingClose(scrubbed: string, from: number): number {
  let depth = 0
  for (let at = from; at < scrubbed.length; at += 1) {
    const char = scrubbed[at]
    if (char === '(' || char === '{' || char === '[') depth += 1
    else if (char === ')' && depth === 0) return at
    else if (char === ')' || char === '}' || char === ']') depth -= 1
  }
  return scrubbed.length
}

/**
 * Collects the property names the factory's returned object literal defines.
 *
 * Only the literal's own keys are exports. A nested one contributes nothing: a factory
 * shaped `{ logger: { error, warn } }` replaces `logger`, and exporting `error` as well
 * would shadow the real export of that name with undefined.
 *
 * @param factory - Source text of the factory, literals already blanked.
 * @returns The property names, deduplicated.
 */
function objectKeys(factory: string): string[] {
  const opening = returnedLiteral(factory)
  if (opening === -1) return []

  const names = new Set<string>()
  let depth = 0

  for (let at = opening; at < factory.length; at += 1) {
    const char = factory[at]
    if (char === '{' || char === '(' || char === '[') depth += 1
    else if (char === '}' || char === ')' || char === ']') {
      depth -= 1
      if (depth === 0) break
    } else if (depth === 1) {
      const key = /^([A-Za-z_$][\w$]*)\s*:/.exec(factory.slice(at))
      if (key?.[1] && !/[\w$]/.test(factory[at - 1] ?? '')) {
        names.add(key[1])
        at += key[0].length - 1
      }
    }
  }

  return [...names]
}

/**
 * Finds the brace opening the object literal the factory returns.
 *
 * @param factory - Source text of the factory, literals already blanked.
 * @returns Index of the opening brace, or -1 when the factory returns something else.
 */
function returnedLiteral(factory: string): number {
  const returned = /\breturn\s*\{/.exec(factory)
  if (returned) return returned.index + returned[0].length - 1

  const arrow = /=>\s*\(?\s*\{/.exec(factory)
  return arrow ? arrow.index + arrow[0].length - 1 : -1
}
