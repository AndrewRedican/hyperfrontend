import type { HttpError } from './http-error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { httpError, isFailureCode, isHttpError, renderFailure } from './http-error'

const BRAND = Symbol.for('@hyperfrontend/server/http-error')

const STATUS_MESSAGE = 'httpError: the status must be an integer between 400 and 599.'
const CODE_MESSAGE = 'httpError: the code must be lower-case words joined by hyphens.'
const HEADERS_MESSAGE = 'httpError: the headers must be a plain object of valid header names and string values.'

class Carrier {
  readonly Allow = 'GET'
}

/**
 * Runs a call that is expected to throw and describes what it threw.
 *
 * @param call - The call under test.
 * @returns The constructor name and message of the thrown error, or `null` when nothing was thrown.
 */
const thrownBy = (call: () => unknown): { type: string; message: string } | null => {
  try {
    call()
  } catch (error) {
    return { type: (error as Error).constructor.name, message: (error as Error).message }
  }
  return null
}

/**
 * Builds what another inlined copy of the kernel would throw: an object carrying the registered mark.
 *
 * @param fields - The fields the object carries beside the mark.
 * @returns The marked object.
 */
const lookAlike = (fields: Record<string, unknown>): unknown => ({ [BRAND]: true, ...fields })

describe('httpError', () => {
  it('carries the status, the code and the headers', () => {
    const error = httpError(405, 'method-not-allowed', { Allow: 'GET, HEAD' })
    expect({ status: error.status, code: error.code, headers: error.headers }).toEqual({
      status: 405,
      code: 'method-not-allowed',
      headers: { Allow: 'GET, HEAD' },
    })
  })

  it('is an Error', () => {
    expect(httpError(404, 'not-found')).toBeInstanceOf(Error)
  })

  it('has the code as its message', () => {
    expect(httpError(404, 'not-found').message).toBe('not-found')
  })

  it('is named HttpError', () => {
    expect(httpError(404, 'not-found').name).toBe('HttpError')
  })

  it('freezes its headers', () => {
    expect(Object.isFrozen(httpError(401, 'unauthenticated', { 'WWW-Authenticate': 'Bearer' }).headers)).toBe(true)
  })

  it('defaults its headers to an empty frozen record', () => {
    const { headers } = httpError(404, 'not-found')
    expect({ headers, frozen: Object.isFrozen(headers) }).toEqual({ headers: {}, frozen: true })
  })

  it('copies the headers it is given', () => {
    const given = { Allow: 'GET' }
    const error = httpError(405, 'method-not-allowed', given)
    given.Allow = 'POST'
    expect(error.headers).toEqual({ Allow: 'GET' })
  })

  it('keeps its fields against assignment', () => {
    const error = httpError(404, 'not-found')
    for (const [field, value] of Object.entries({ status: 200, code: 'changed', name: 'Other', headers: { Allow: 'GET' } })) {
      try {
        Object.assign(error, { [field]: value })
      } catch {
        // note: an assignment to a read-only field throws in strict code, which is the refusal under test
      }
    }
    expect({ status: error.status, code: error.code, name: error.name, headers: error.headers }).toEqual({
      status: 404,
      code: 'not-found',
      name: 'HttpError',
      headers: {},
    })
  })

  it('accepts the two ends of the status range', () => {
    expect([httpError(400, 'low').status, httpError(599, 'high').status]).toEqual([400, 599])
  })

  it.each([
    ['399', 399],
    ['600', 600],
    ['400.5', 400.5],
    ['NaN', Number.NaN],
    ['a numeric string', '404'],
  ])('refuses the status %s', (_label, status) => {
    expect(thrownBy(() => httpError(status as number, 'not-found'))).toEqual({ type: 'TypeError', message: STATUS_MESSAGE })
  })

  it.each([
    ['an upper-case letter', 'Not-Found'],
    ['a space', 'not found'],
    ['nothing', ''],
    ['a leading hyphen', '-found'],
    ['a trailing hyphen', 'not-'],
    ['two hyphens together', 'not--found'],
    ['a line break', 'not-found\n'],
  ])('refuses a code holding %s', (_label, code) => {
    expect(thrownBy(() => httpError(404, code))).toEqual({ type: 'TypeError', message: CODE_MESSAGE })
  })

  it('refuses a code that is not a string', () => {
    expect(thrownBy(() => httpError(404, 404 as unknown as string))).toEqual({ type: 'TypeError', message: CODE_MESSAGE })
  })

  it.each([
    ['a Map', new Map([['Allow', 'GET']])],
    ['a class instance', new Carrier()],
    ['an array', ['Allow']],
    ['null', null],
    ['a Transfer-Encoding header', { 'Transfer-Encoding': 'chunked' }],
    ['a Connection header', { connection: 'close' }],
    ['a value with a carriage return and a line feed', { 'X-Note': 'ok\r\nSet-Cookie: session=stolen' }],
    ['a value that is not a string', { 'Retry-After': 30 }],
    ['two spellings of one name', { Allow: 'GET', allow: 'POST' }],
    ['a malformed Content-Length', { 'Content-Length': '01' }],
  ])('refuses headers that are %s', (_label, headers) => {
    expect(thrownBy(() => httpError(405, 'method-not-allowed', headers as unknown as Record<string, string>))).toEqual({
      type: 'TypeError',
      message: HEADERS_MESSAGE,
    })
  })

  it('carries the mark another copy of the kernel looks for', () => {
    expect((httpError(404, 'not-found') as unknown as Record<symbol, unknown>)[BRAND]).toBe(true)
  })
})

describe('isFailureCode', () => {
  it.each(['internal', 'not-found', 'http2-only', '404'])('accepts %s', (code) => {
    expect(isFailureCode(code)).toBe(true)
  })

  it.each([
    ['free text', 'Not found.'],
    ['an empty string', ''],
    ['an underscore', 'not_found'],
    ['a number', 404],
    ['undefined', undefined],
  ])('refuses %s', (_label, code) => {
    expect(isFailureCode(code)).toBe(false)
  })
})

describe('isHttpError', () => {
  it('recognises a built failure', () => {
    expect(isHttpError(httpError(410, 'gone'))).toBe(true)
  })

  it('recognises a well-formed failure built by another copy of the kernel', () => {
    expect(isHttpError(lookAlike({ status: 401, code: 'unauthenticated', headers: { 'WWW-Authenticate': 'Bearer' } }))).toBe(true)
  })

  it('recognises one whose headers have no prototype', () => {
    expect(isHttpError(lookAlike({ status: 404, code: 'not-found', headers: Object.create(null) }))).toBe(true)
  })

  it.each([
    ['a free-text code', { status: 500, code: 'Database password is hunter2', headers: {} }],
    ['a code that is not a string', { status: 500, code: 500, headers: {} }],
    ['the status 200', { status: 200, code: 'ok', headers: {} }],
    ['the status 600', { status: 600, code: 'beyond', headers: {} }],
    ['a fractional status', { status: 400.5, code: 'half', headers: {} }],
    ['headers that are a Map', { status: 404, code: 'not-found', headers: new Map() }],
    ['no headers', { status: 404, code: 'not-found' }],
  ])('refuses a marked object with %s', (_label, fields) => {
    expect(isHttpError(lookAlike(fields))).toBe(false)
  })

  it('refuses an object whose mark is not true', () => {
    expect(isHttpError({ [BRAND]: 'yes', status: 404, code: 'not-found', headers: {} })).toBe(false)
  })

  it('refuses an Error with a status and a code but no mark', () => {
    expect(isHttpError(Object.assign(new Error('not-found'), { status: 404, code: 'not-found', headers: {} }))).toBe(false)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not-found'],
    ['a function', Object.assign(() => 404, { [BRAND]: true, status: 404, code: 'not-found', headers: {} })],
  ])('refuses %s', (_label, value) => {
    expect(isHttpError(value)).toBe(false)
  })

  it('refuses, without throwing, an object whose mark cannot be read', () => {
    const hostile = Object.defineProperty({ status: 404, code: 'not-found', headers: {} }, BRAND, {
      get: () => {
        throw new Error('unreadable')
      },
    })
    expect(isHttpError(hostile)).toBe(false)
  })
})

describe('renderFailure', () => {
  /**
   * Renders a failure and reads the body as text.
   *
   * @param error - The failure to render.
   * @returns The response with its body decoded.
   */
  const rendered = (error: HttpError): { status: number; headers: Readonly<Record<string, string>>; body: string | undefined } => {
    const response = renderFailure(error)
    return { status: response.status, headers: response.headers, body: response.body?.toString() }
  }

  it('answers with the status, plain text that is never stored, and the reason phrase', () => {
    expect(rendered(httpError(404, 'not-found'))).toEqual({
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: 'Not Found',
    })
  })

  it('writes Error for a status Node has no phrase for', () => {
    expect(rendered(httpError(599, 'unnamed')).body).toBe('Error')
  })

  it('keeps the code out of the response', () => {
    expect(JSON.stringify(rendered(httpError(401, 'marker-code')))).not.toContain('marker-code')
  })

  it('lets a failure header replace the content type under another spelling', () => {
    expect(rendered(httpError(406, 'not-acceptable', { 'content-type': 'application/problem+json' })).headers).toEqual({
      'Cache-Control': 'no-store',
      'content-type': 'application/problem+json',
    })
  })

  it('passes a failure header through beside the defaults', () => {
    expect(rendered(httpError(405, 'method-not-allowed', { Allow: 'GET, HEAD' })).headers).toEqual({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      Allow: 'GET, HEAD',
    })
  })

  it('returns a body of bytes', () => {
    expect(renderFailure(httpError(500, 'internal')).body).toBeInstanceOf(Buffer)
  })
})
