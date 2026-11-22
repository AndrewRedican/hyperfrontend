import { validateHeaderName, validateHeaderValue } from 'node:http'
import { entries, fromEntries, getPrototypeOf, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

// note: Headers that describe the connection, which Node and the listener set themselves; a response that names one could desynchronise the framing.
const CONNECTION_HEADERS: readonly string[] = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'trailer', 'te']

// note: A decimal count as a response may declare it: zero, or digits that do not start with zero.
const DECIMAL_COUNT = /^(0|[1-9][0-9]*)$/

// note: The prototype every object literal has, read once so a later change to the global cannot widen what counts as plain.
const OBJECT_PROTOTYPE: unknown = getPrototypeOf({})

/**
 * Reports whether a value is a plain object: one written as a literal, or one without a prototype.
 * A `Map`, a fetch `Headers`, an array and a class instance are not, since none of them has its entries as own keys.
 *
 * @param value - The value to judge.
 * @returns `true` for a non-null object whose prototype is the object prototype or `null`.
 *
 * @example Telling a record from a Map
 * ```typescript
 * isPlainObject({ Allow: 'GET' }) // true
 * isPlainObject(new Map([['Allow', 'GET']])) // false
 * ```
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype: unknown = getPrototypeOf(value)
  return prototype === null || prototype === OBJECT_PROTOTYPE
}

/**
 * Sets one header on a copy of a header record, so that the name is never left under two spellings.
 * A header of the same spelling keeps its place; one of another spelling is dropped and the new spelling goes last.
 *
 * @param headers - The record to copy.
 * @param name - The header name, spelled as it should be sent.
 * @param value - What the header is set to.
 * @returns A new record; the one passed in is left as it was.
 *
 * @example Replacing a header written in another case
 * ```typescript
 * setHeader({ 'content-type': 'text/html' }, 'Content-Type', 'text/plain')
 * // => { 'Content-Type': 'text/plain' }
 * ```
 */
export function setHeader(headers: Readonly<Record<string, string>>, name: string, value: string): Record<string, string> {
  const wanted = name.toLowerCase()
  // why: built from entries, so a header named like the prototype accessor becomes an own entry instead of being swallowed by an assignment
  return fromEntries([...entries(headers).filter(([key]) => key === name || key.toLowerCase() !== wanted), [name, value]])
}

/**
 * Adds one token to the `Vary` header of a copy of a header record.
 * A value that is `*`, or that already lists the token in any case, is left; an existing header keeps the spelling of its name.
 *
 * @param headers - The record to copy.
 * @param token - The request header name responses vary on, for example `Origin`.
 * @returns A new record; the one passed in is left as it was.
 *
 * @example Marking a response that already varies on the encoding
 * ```typescript
 * appendVary({ vary: 'Accept-Encoding' }, 'Origin')
 * // => { vary: 'Accept-Encoding, Origin' }
 * ```
 */
export function appendVary(headers: Readonly<Record<string, string>>, token: string): Record<string, string> {
  const name = keys(headers).find((key) => key.toLowerCase() === 'vary')
  if (name === undefined) {
    return setHeader(headers, 'Vary', token)
  }
  const current = headers[name] as string
  const listed = current.split(',').map((entry) => entry.trim().toLowerCase())
  if (listed.includes('*') || listed.includes(token.toLowerCase())) {
    return { ...headers }
  }
  return setHeader(headers, name, current.trim() === '' ? token : `${current}, ${token}`)
}

/**
 * Judges one header against the rules a response header must keep.
 *
 * @param name - The header name as written.
 * @param value - What the record holds under it.
 * @param seen - The lower-cased names judged before this one.
 * @returns A fixed sentence for the first rule broken, or `null`.
 */
function headerProblem(name: string, value: unknown, seen: readonly string[]): string | null {
  const lower = name.toLowerCase()
  try {
    validateHeaderName(name)
  } catch {
    return 'a header name is not valid'
  }
  if (seen.includes(lower)) {
    return 'a header is given under two spellings'
  }
  if (CONNECTION_HEADERS.includes(lower)) {
    return 'a header belongs to the connection'
  }
  if (typeof value !== 'string') {
    return 'a header value is not a string'
  }
  try {
    validateHeaderValue(name, value)
  } catch {
    return 'a header value is not valid'
  }
  return lower === 'content-length' && !DECIMAL_COUNT.test(value) ? 'a Content-Length is not a decimal count' : null
}

/**
 * Finds what stops a value from being sent as response headers: it must be a plain object whose names and values
 * Node accepts, with no name under two spellings, no header of the connection, and a `Content-Length` that is a decimal count.
 * The sentence returned is fixed text and holds nothing of the headers. It never throws.
 *
 * @param headers - The value offered as headers, which no check need have seen.
 * @returns A fixed sentence for the first problem, or `null` when there is none.
 *
 * @example Refusing a header that would end the head early
 * ```typescript
 * headersProblem({ Allow: 'GET' }) // null
 * headersProblem({ 'X-Note': 'ok\r\nSet-Cookie: a=b' }) // 'a header value is not valid'
 * ```
 */
export function headersProblem(headers: unknown): string | null {
  try {
    if (!isPlainObject(headers)) {
      return 'the headers are not a plain object'
    }
    const seen: string[] = []
    for (const name of keys(headers)) {
      const problem = headerProblem(name, headers[name], seen)
      if (problem !== null) {
        return problem
      }
      seen.push(name.toLowerCase())
    }
    return null
  } catch {
    // why: a getter or a proxy trap may throw while the record is read, and a check that throws would escape the boundary that called it
    return 'the headers could not be read'
  }
}
