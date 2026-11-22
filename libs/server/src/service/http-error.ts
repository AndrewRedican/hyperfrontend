import type { ServiceResponse } from './contract'
import { STATUS_CODES } from 'node:http'
import { createError, createTypeError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { defineProperties, freeze, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { symbolFor } from '@hyperfrontend/immutable-api-utils/built-in-copy/symbol'
import { headersProblem, isPlainObject, setHeader } from './headers'

// note: A registered symbol, so two copies of the kernel inlined into one process recognise each other's failures.
const BRAND = symbolFor('@hyperfrontend/server/http-error')

// note: One word of a failure code; a code is such words joined by single hyphens.
const CODE_WORD = /^[a-z0-9]+$/

/** A failure a step chose: a status and a stable machine code, never free text. Thrown from any depth, it becomes the response at the nearest `next()` boundary. */
export interface HttpError extends Error {
  /** Always `HttpError`. */
  readonly name: 'HttpError'
  /** The response status, 400 to 599. */
  readonly status: number
  /** A stable code matching `[a-z0-9]+(-[a-z0-9]+)*`; also the error's message. */
  readonly code: string
  /** Headers the response carries, for example `Allow`, `Retry-After` or `WWW-Authenticate`. Frozen. */
  readonly headers: Readonly<Record<string, string>>
}

/**
 * Reports whether a value is a status a failure may carry.
 *
 * @param value - The value offered as a status.
 * @returns `true` for an integer from 400 to 599.
 */
function isFailureStatus(value: unknown): value is number {
  return isInteger(value) && (value as number) >= 400 && (value as number) <= 599
}

/**
 * Reports whether a value is a failure code: lower-case words of letters and digits joined by single hyphens.
 * It is the one shape a code may have wherever the kernel accepts one, so that no free text reaches a log through it.
 *
 * @param value - The value offered as a code.
 * @returns `true` for a string matching `[a-z0-9]+(-[a-z0-9]+)*`.
 *
 * @example Telling a code from a sentence
 * ```typescript
 * isFailureCode('body-too-large') // true
 * isFailureCode('Body too large.') // false
 * ```
 */
export function isFailureCode(value: unknown): value is string {
  return typeof value === 'string' && value.split('-').every((word) => CODE_WORD.test(word))
}

/**
 * Builds a throwable failure. Throws a `TypeError` for a status outside 400 to 599, a code that is not lower-case words joined by hyphens, or headers a response could not carry.
 *
 * @param status - The response status, 400 to 599.
 * @param code - The stable machine code, which is also the message; it reaches the log and never the client.
 * @param headers - Headers the response carries; none when omitted.
 * @returns The failure, ready to throw.
 * @throws {TypeError} With a fixed message that holds nothing of the arguments, so a failure that could not be written is refused where it is built.
 *
 * @example Refusing a request that carries no credentials
 * ```typescript
 * import { httpError } from '@hyperfrontend/server'
 *
 * throw httpError(401, 'unauthenticated', { 'WWW-Authenticate': 'Bearer' })
 * ```
 */
export function httpError(status: number, code: string, headers?: Readonly<Record<string, string>>): HttpError {
  if (!isFailureStatus(status)) {
    throw createTypeError('httpError: the status must be an integer between 400 and 599.')
  }
  if (!isFailureCode(code)) {
    throw createTypeError('httpError: the code must be lower-case words joined by hyphens.')
  }
  const given = headers === undefined ? {} : headers
  if (headersProblem(given) !== null) {
    throw createTypeError('httpError: the headers must be a plain object of valid header names and string values.')
  }
  return defineProperties(createError(code), {
    name: { value: 'HttpError' },
    status: { value: status, enumerable: true },
    code: { value: code, enumerable: true },
    headers: { value: freeze({ ...given }), enumerable: true },
    [BRAND]: { value: true },
  }) as HttpError
}

/**
 * Recognises a failure built by any copy of the kernel in the process: the kernel's mark, a status from 400 to 599, a well-formed code and a plain headers object.
 *
 * @param value - Anything a step threw or rejected with.
 * @returns `true` only for a marked object whose fields are well formed; it never throws.
 *
 * @example Translating one failure and passing the others on
 * ```typescript
 * import { httpError, isHttpError } from '@hyperfrontend/server'
 *
 * try {
 *   await request.body.json()
 * } catch (error) {
 *   if (isHttpError(error) && error.status === 413) throw httpError(422, 'document-too-large')
 *   throw error
 * }
 * ```
 */
export function isHttpError(value: unknown): value is HttpError {
  try {
    if (typeof value !== 'object' || value === null) {
      return false
    }
    const candidate = value as Record<PropertyKey, unknown>
    return (
      candidate[BRAND] === true &&
      isFailureStatus(candidate['status']) &&
      isFailureCode(candidate['code']) &&
      isPlainObject(candidate['headers'])
    )
  } catch {
    // why: a getter or a proxy trap on a thrown value may throw, and the boundary that asks must still get an answer
    return false
  }
}

/**
 * Renders a failure as the response a client receives: its status, plain text that is never stored, each of its headers
 * in place of a default of the same name in any spelling, and the status's reason phrase as the body. The code stays out of it.
 *
 * @param error - The failure to render.
 * @returns The response, which no check has seen yet.
 *
 * @example Rendering a wrong-method refusal
 * ```typescript
 * renderFailure(httpError(405, 'method-not-allowed', { Allow: 'GET, HEAD' }))
 * // => { status: 405, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', Allow: 'GET, HEAD' }, body: <Method Not Allowed> }
 * ```
 */
export function renderFailure(error: HttpError): ServiceResponse {
  const defaults: Record<string, string> = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  return {
    status: error.status,
    headers: keys(error.headers).reduce((headers, name) => setHeader(headers, name, error.headers[name] as string), defaults),
    body: Buffer.from(STATUS_CODES[error.status] ?? 'Error'),
  }
}
