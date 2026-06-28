import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Reports whether a char code may legally begin an identifier (`A-Za-z_$`).
 *
 * @param code - The UTF-16 code unit to test.
 * @returns True for an identifier-start character.
 */
function isIdentifierStart(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36
}

/**
 * Reports whether a char code may follow the first identifier character.
 *
 * @param code - The UTF-16 code unit to test.
 * @returns True for an identifier-start character or a decimal digit.
 */
function isIdentifierPart(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57)
}

/**
 * Reports whether a key is a bare-usable identifier (no quoting needed).
 *
 * @param key - The property name to test.
 * @returns True when every character is a legal identifier character.
 */
function isIdentifier(key: string): boolean {
  if (key.length === 0 || !isIdentifierStart(key.charCodeAt(0))) {
    return false
  }
  for (let index = 1; index < key.length; index += 1) {
    if (!isIdentifierPart(key.charCodeAt(index))) {
      return false
    }
  }
  return true
}

/**
 * Renders a string as a single-quoted TypeScript string literal.
 *
 * Embedded double quotes are left bare (legal inside single quotes); single
 * quotes and backslashes are escaped; control characters keep their JSON escape.
 *
 * @param value - The string to render.
 * @returns A single-quoted, safely escaped string literal.
 */
function quoteString(value: string): string {
  // how: JSON encoding already escapes backslashes and control chars; we scan it to swap quote conventions (unescape \" to ", escape ' to \') while copying every other escape verbatim, so an input backslash stays intact.
  const body = stringify(value).slice(1, -1)
  let inner = ''
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (char === '\\') {
      const next = body[index + 1]
      inner += next === '"' ? '"' : char + next
      index += 1
    } else if (char === "'") {
      inner += "\\'"
    } else {
      inner += char
    }
  }
  return `'${inner}'`
}

/**
 * Renders an object key, leaving valid identifiers bare and quoting the rest.
 *
 * @param key - The property name.
 * @returns The key as written in an object literal.
 */
function formatKey(key: string): string {
  return isIdentifier(key) ? key : quoteString(key)
}

/**
 * Renders a JSON-compatible value as formatted TypeScript source.
 *
 * Produces idiomatic source (single-quoted strings, unquoted identifier keys)
 * rather than JSON, so inlined `const`s read like hand-written code. Undefined
 * object members are dropped, matching JSON serialization.
 *
 * @param value - The value to render.
 * @param indent - The current indentation prefix; defaults to none.
 * @returns The value as a TypeScript expression.
 *
 * @example Inlining a contract
 * ```typescript
 * toSourceLiteral({ name: 'clock', accepted: [{ type: 'setTimezone' }] })
 * // => "{\n  name: 'clock',\n  accepted: [\n    { type: 'setTimezone' },\n  ],\n}"  (illustrative)
 * ```
 */
export function toSourceLiteral(value: unknown, indent = ''): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return quoteString(value)
  }
  if (isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }
    const inner = `${indent}  `
    return `[\n${value.map((item) => `${inner}${toSourceLiteral(item, inner)}`).join(',\n')},\n${indent}]`
  }
  if (typeof value === 'object') {
    const props = entries(<Record<string, unknown>>value).filter(([, member]) => member !== undefined)
    if (props.length === 0) {
      return '{}'
    }
    const inner = `${indent}  `
    const body = props.map(([key, member]) => `${inner}${formatKey(key)}: ${toSourceLiteral(member, inner)}`).join(',\n')
    return `{\n${body},\n${indent}}`
  }
  return stringify(value)
}
