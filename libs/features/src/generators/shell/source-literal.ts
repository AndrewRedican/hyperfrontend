import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// how: A JSON double-quoted string and a single-quoted JS string differ only in which quote is escaped, so quoteString reuses JSON escaping (correct \n, \\, \uXXXX) and swaps the convention rather than re-implementing it.
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

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
  const inner = stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")
  return `'${inner}'`
}

/**
 * Renders an object key, leaving valid identifiers bare and quoting the rest.
 *
 * @param key - The property name.
 * @returns The key as written in an object literal.
 */
function formatKey(key: string): string {
  return IDENTIFIER.test(key) ? key : quoteString(key)
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
