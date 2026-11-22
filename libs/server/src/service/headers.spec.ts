import { describe, expect, it } from '@hyperfrontend/testing'
import { appendVary, headersProblem, isPlainObject, setHeader } from './headers'

class Carrier {
  readonly Allow = 'GET'
}

const withoutPrototype = (headers: Record<string, string>): Record<string, string> => Object.assign(Object.create(null), headers)

describe('setHeader', () => {
  it('adds a header that is absent, after the ones present', () => {
    expect(Object.entries(setHeader({ ETag: 'W/"1"' }, 'Vary', 'Origin'))).toEqual([
      ['ETag', 'W/"1"'],
      ['Vary', 'Origin'],
    ])
  })

  it('replaces a header of the same spelling where it stands', () => {
    expect(Object.entries(setHeader({ Vary: 'Accept', ETag: 'W/"1"' }, 'Vary', 'Origin'))).toEqual([
      ['Vary', 'Origin'],
      ['ETag', 'W/"1"'],
    ])
  })

  it('replaces a header of another spelling and drops that spelling', () => {
    expect(Object.entries(setHeader({ 'content-type': 'text/html', ETag: 'W/"1"' }, 'Content-Type', 'text/plain'))).toEqual([
      ['ETag', 'W/"1"'],
      ['Content-Type', 'text/plain'],
    ])
  })

  it('does not mutate its input', () => {
    const headers = Object.freeze({ 'content-type': 'text/html' })
    setHeader(headers, 'Content-Type', 'text/plain')
    expect(headers).toEqual({ 'content-type': 'text/html' })
  })

  it('reads a record without a prototype', () => {
    expect(setHeader(withoutPrototype({ vary: 'Accept' }), 'Vary', 'Origin')).toEqual({ Vary: 'Origin' })
  })

  it('keeps a header named like the prototype accessor as an own entry', () => {
    expect(Object.entries(setHeader({}, '__proto__', 'kept'))).toEqual([['__proto__', 'kept']])
  })
})

describe('appendVary', () => {
  it('sets the header when it is absent', () => {
    expect(appendVary({ ETag: 'W/"1"' }, 'Origin')).toEqual({ ETag: 'W/"1"', Vary: 'Origin' })
  })

  it('appends to an existing value, keeping the spelling of its name', () => {
    expect(appendVary({ vary: 'Accept-Encoding' }, 'Origin')).toEqual({ vary: 'Accept-Encoding, Origin' })
  })

  it('leaves a value that varies on everything', () => {
    expect(appendVary({ Vary: '*' }, 'Origin')).toEqual({ Vary: '*' })
  })

  it('leaves a value that lists the token in another case', () => {
    expect(appendVary({ Vary: 'Accept, origin' }, 'Origin')).toEqual({ Vary: 'Accept, origin' })
  })

  it('replaces an empty value instead of appending to it', () => {
    expect(appendVary({ Vary: ' ' }, 'Origin')).toEqual({ Vary: 'Origin' })
  })

  it('returns a new record when it leaves the value', () => {
    const headers = { Vary: '*' }
    expect(appendVary(headers, 'Origin')).not.toBe(headers)
  })

  it('does not mutate its input', () => {
    const headers = Object.freeze({ Vary: 'Accept' })
    appendVary(headers, 'Origin')
    expect(headers).toEqual({ Vary: 'Accept' })
  })
})

describe('isPlainObject', () => {
  it('accepts an object literal', () => {
    expect(isPlainObject({ Allow: 'GET' })).toBe(true)
  })

  it('accepts an object without a prototype', () => {
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it.each([
    ['null', null],
    ['an array', ['Allow']],
    ['a Map', new Map([['Allow', 'GET']])],
    ['a class instance', new Carrier()],
    ['a function', () => 'GET'],
    ['a string', 'Allow'],
    ['undefined', undefined],
  ])('refuses %s', (_label, value) => {
    expect(isPlainObject(value)).toBe(false)
  })
})

describe('headersProblem', () => {
  it('finds nothing in a valid record', () => {
    expect(headersProblem({ 'Content-Type': 'text/plain', 'Content-Length': '12', Allow: 'GET, HEAD' })).toBeNull()
  })

  it('finds nothing in a valid record without a prototype', () => {
    expect(headersProblem(withoutPrototype({ Allow: 'GET', 'content-length': '0' }))).toBeNull()
  })

  it('finds nothing in an empty record', () => {
    expect(headersProblem({})).toBeNull()
  })

  it.each([
    ['a Map', new Map([['Allow', 'GET']])],
    ['a fetch Headers', new Headers({ Allow: 'GET' })],
    ['an array', ['Allow']],
    ['a class instance', new Carrier()],
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s as not a plain object', (_label, headers) => {
    expect(headersProblem(headers)).toBe('the headers are not a plain object')
  })

  it.each([
    ['a space', 'Bad Name'],
    ['a colon', 'Bad:Name'],
    ['nothing', ''],
  ])('refuses a name holding %s', (_label, name) => {
    expect(headersProblem({ [name]: 'value' })).toBe('a header name is not valid')
  })

  it.each([
    ['the lower-case one last', { 'Content-Type': 'text/plain', 'content-type': 'text/html' }],
    ['the lower-case one first', { 'content-type': 'text/html', 'Content-Type': 'text/plain' }],
    ['neither in lower case', { 'Content-Type': 'text/plain', 'CONTENT-TYPE': 'text/html' }],
  ])('refuses two spellings of one name, %s', (_label, headers) => {
    expect(headersProblem(headers)).toBe('a header is given under two spellings')
  })

  it.each(['Connection', 'keep-alive', 'Transfer-Encoding', 'UPGRADE', 'Trailer', 'TE'])('refuses the connection header %s', (name) => {
    expect(headersProblem({ [name]: 'close' })).toBe('a header belongs to the connection')
  })

  it.each([
    ['a number', 12],
    ['an array', ['a', 'b']],
    ['undefined', undefined],
    ['null', null],
  ])('refuses a value that is %s', (_label, value) => {
    expect(headersProblem({ 'X-Count': value })).toBe('a header value is not a string')
  })

  it.each([
    ['a carriage return and a line feed', 'ok\r\nSet-Cookie: session=stolen'],
    ['a line feed', 'ok\nnext'],
    ['a NUL', 'ok\u0000'],
  ])('refuses a value holding %s', (_label, value) => {
    expect(headersProblem({ 'X-Note': value })).toBe('a header value is not valid')
  })

  it.each([
    ['letters', 'abc'],
    ['a leading zero', '01'],
    ['a sign', '+1'],
    ['nothing', ''],
  ])('refuses a Content-Length of %s', (_label, value) => {
    expect(headersProblem({ 'content-length': value })).toBe('a Content-Length is not a decimal count')
  })

  it('accepts a Content-Length of zero under any spelling', () => {
    expect(headersProblem({ 'CONTENT-LENGTH': '0' })).toBeNull()
  })

  it('refuses a record whose header cannot be read, without throwing', () => {
    const headers = Object.defineProperty({}, 'Allow', {
      enumerable: true,
      get: () => {
        throw new Error('unreadable')
      },
    })
    expect(headersProblem(headers)).toBe('the headers could not be read')
  })

  it('names no header and no value in what it reports', () => {
    expect(headersProblem({ 'X-Marker-Name': 'marker\r\nvalue' })).not.toMatch(/marker/i)
  })
})
