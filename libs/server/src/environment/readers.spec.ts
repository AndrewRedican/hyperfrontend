import type { Reader } from './readers'
import { describe, expect, it } from '@hyperfrontend/testing'
import { asDuration, asOrigin, asPort, asSecret, asText, asUrl } from './readers'

type Shape = Pick<Reader<unknown>, 'expected' | 'secret'> & Record<'frozen', boolean>

// note: A string no reader may ever hand back in an error: the readers refuse by returning nothing.
const MARKER = 'marker-7f3a9c'

/**
 * Describes a reader by what a declaration reads from it.
 *
 * @param reader - The reader under test.
 * @returns Its phrase, its secrecy and whether it is frozen.
 */
function shapeOf(reader: Reader<unknown>): Shape {
  return { expected: reader.expected, secret: reader.secret, frozen: Object.isFrozen(reader) }
}

describe('asPort', () => {
  it('describes a port above zero', () => {
    expect(shapeOf(asPort())).toEqual({ expected: 'an integer between 1 and 65535', secret: false, frozen: true })
  })

  it('describes a port that may be zero', () => {
    expect(shapeOf(asPort({ allowZero: true }))).toEqual({ expected: 'an integer between 0 and 65535', secret: false, frozen: true })
  })

  it('keeps zero out when the option is switched off', () => {
    expect(shapeOf(asPort({ allowZero: false }))).toEqual({ expected: 'an integer between 1 and 65535', secret: false, frozen: true })
  })

  it.each([
    ['1', 1],
    ['8080', 8080],
    ['65535', 65535],
  ])('reads %s', (raw: string, port: number) => {
    expect(asPort().read(raw)).toBe(port)
  })

  it.each([['0'], ['65536'], ['100000'], ['-1'], ['+1'], ['1.0'], ['1e3'], ['0x50'], ['080'], [' 80'], ['80 '], ['80\n'], ['']])(
    'refuses %p',
    (raw: string) => {
      expect(asPort().read(raw)).toBeUndefined()
    }
  )

  it('reads zero when zero is allowed', () => {
    expect(asPort({ allowZero: true }).read('0')).toBe(0)
  })

  it('still reads a port above zero when zero is allowed', () => {
    expect(asPort({ allowZero: true }).read('8080')).toBe(8080)
  })

  it.each([['00'], ['-0'], ['65536'], ['']])('refuses %p when zero is allowed', (raw: string) => {
    expect(asPort({ allowZero: true }).read(raw)).toBeUndefined()
  })
})

describe('asUrl', () => {
  it('describes an https URL', () => {
    expect(shapeOf(asUrl())).toEqual({ expected: 'an https URL without credentials', secret: false, frozen: true })
  })

  it('describes a URL of either scheme', () => {
    expect(shapeOf(asUrl({ allowHttp: true }))).toEqual({
      expected: 'an http or https URL without credentials',
      secret: false,
      frozen: true,
    })
  })

  it('returns the normalised href of an https URL', () => {
    expect(asUrl().read('HTTPS://Issuer.Example')).toBe('https://issuer.example/')
  })

  it('keeps a path, a query and a fragment', () => {
    expect(asUrl().read('https://issuer.example/realms/main?audience=api#keys')).toBe(
      'https://issuer.example/realms/main?audience=api#keys'
    )
  })

  it.each([
    ['http://localhost:8080/', 'http://localhost:8080/'],
    ['http://127.0.0.1/', 'http://127.0.0.1/'],
    ['http://[::1]:3000/', 'http://[::1]:3000/'],
  ])('accepts plain http for the loopback host of %s', (raw: string, href: string) => {
    expect(asUrl().read(raw)).toBe(href)
  })

  it('refuses plain http for any other host', () => {
    expect(asUrl().read('http://example.com/')).toBeUndefined()
  })

  it('refuses plain http when the option is switched off', () => {
    expect(asUrl({ allowHttp: false }).read('http://example.com/')).toBeUndefined()
  })

  it('accepts plain http for any host when it is allowed', () => {
    expect(asUrl({ allowHttp: true }).read('http://example.com/')).toBe('http://example.com/')
  })

  it('still accepts https when plain http is allowed', () => {
    expect(asUrl({ allowHttp: true }).read('https://example.com/')).toBe('https://example.com/')
  })

  it.each([['https://user:pass@example.com/'], ['https://user@example.com/'], ['https://:pass@example.com/']])(
    'refuses the credentials of %s',
    (raw: string) => {
      expect(asUrl().read(raw)).toBeUndefined()
    }
  )

  it.each([['ftp://example.com/'], ['file:///etc/passwd'], ['javascript:alert(1)']])('refuses the scheme of %s', (raw: string) => {
    expect(asUrl({ allowHttp: true }).read(raw)).toBeUndefined()
  })

  it.each([[`not a url ${MARKER}`], ['/relative/path'], ['example.com'], ['']])('refuses %p without throwing', (raw: string) => {
    expect(asUrl().read(raw)).toBeUndefined()
  })
})

describe('asOrigin', () => {
  it('describes an https origin', () => {
    expect(shapeOf(asOrigin())).toEqual({ expected: 'an https origin (scheme, host and optional port)', secret: false, frozen: true })
  })

  it('describes an origin of either scheme', () => {
    expect(shapeOf(asOrigin({ allowHttp: true }))).toEqual({
      expected: 'an http or https origin (scheme, host and optional port)',
      secret: false,
      frozen: true,
    })
  })

  it('returns the origin as written', () => {
    expect(asOrigin().read('https://site.example')).toBe('https://site.example')
  })

  it('returns the origin without a trailing slash', () => {
    expect(asOrigin().read('https://site.example/')).toBe('https://site.example')
  })

  it('keeps a port that is not the default', () => {
    expect(asOrigin().read('https://site.example:8443')).toBe('https://site.example:8443')
  })

  it('drops the default port', () => {
    expect(asOrigin().read('https://site.example:443')).toBe('https://site.example')
  })

  it.each([
    ['https://site.example/app'],
    ['https://site.example/?page=1'],
    ['https://site.example/#top'],
    ['https://site.example/?'],
    ['https://site.example/#'],
  ])('refuses %s, which is more than an origin', (raw: string) => {
    expect(asOrigin().read(raw)).toBeUndefined()
  })

  it('accepts plain http for a loopback host', () => {
    expect(asOrigin().read('http://localhost:5173')).toBe('http://localhost:5173')
  })

  it('refuses plain http for any other host', () => {
    expect(asOrigin().read('http://site.example')).toBeUndefined()
  })

  it('accepts plain http for any host when it is allowed', () => {
    expect(asOrigin({ allowHttp: true }).read('http://site.example')).toBe('http://site.example')
  })

  it('refuses credentials', () => {
    expect(asOrigin().read('https://user:pass@site.example')).toBeUndefined()
  })

  it.each([[`not an origin ${MARKER}`], ['']])('refuses %p without throwing', (raw: string) => {
    expect(asOrigin().read(raw)).toBeUndefined()
  })
})

describe('asDuration', () => {
  it('describes a duration', () => {
    expect(shapeOf(asDuration())).toEqual({ expected: 'a duration such as 250ms, 30s, 5m or 1h', secret: false, frozen: true })
  })

  it.each([
    ['250ms', 250],
    ['30s', 30000],
    ['5m', 300000],
    ['1h', 3600000],
    ['0s', 0],
    ['999999999999999ms', 999999999999999],
  ])('reads %s as milliseconds', (raw: string, milliseconds: number) => {
    expect(asDuration().read(raw)).toBe(milliseconds)
  })

  it.each([['30'], ['1d'], ['1.5s'], ['-1s'], ['01s'], [' 1s'], ['1s '], ['1S'], ['s'], ['1000000000000000ms'], ['']])(
    'refuses %p',
    (raw: string) => {
      expect(asDuration().read(raw)).toBeUndefined()
    }
  )

  it('refuses a product past the safe integer range', () => {
    expect(asDuration().read('999999999999999h')).toBeUndefined()
  })
})

describe('asSecret', () => {
  it('describes a secret of sixteen characters', () => {
    expect(shapeOf(asSecret())).toEqual({ expected: 'a secret of at least 16 characters', secret: true, frozen: true })
  })

  it('describes a secret of the given length', () => {
    expect(shapeOf(asSecret({ minLength: 32 }))).toEqual({ expected: 'a secret of at least 32 characters', secret: true, frozen: true })
  })

  it('wraps sixteen characters', () => {
    expect(asSecret().read('0123456789abcdef')?.reveal()).toBe('0123456789abcdef')
  })

  it('hands back a value that prints the mask', () => {
    expect(String(asSecret().read(`${MARKER}-0123456789`))).toBe('[secret]')
  })

  it('refuses fifteen characters', () => {
    expect(asSecret().read('0123456789abcde')).toBeUndefined()
  })

  it('refuses the empty string', () => {
    expect(asSecret().read('')).toBeUndefined()
  })

  it('accepts a shorter secret under a lower minimum', () => {
    expect(asSecret({ minLength: 4 }).read('abcd')?.reveal()).toBe('abcd')
  })

  it('refuses a secret one character short of a higher minimum', () => {
    expect(asSecret({ minLength: 32 }).read('0123456789abcdef0123456789abcde')).toBeUndefined()
  })

  it.each([[0], [1.5], [-1], [Number.NaN], [Number.POSITIVE_INFINITY], ['16']])(
    'throws at the call for a minimum of %p',
    (minLength: unknown) => {
      expect(() => asSecret({ minLength: minLength as number })).toThrow({
        name: 'TypeError',
        message: 'asSecret: "minLength" must be a positive integer.',
      })
    }
  )
})

describe('asText', () => {
  it('describes any text', () => {
    expect(shapeOf(asText())).toEqual({ expected: 'non-empty text', secret: false, frozen: true })
  })

  it('returns the text untrimmed', () => {
    expect(asText().read('  hello world \n')).toBe('  hello world \n')
  })

  it('refuses the empty string', () => {
    expect(asText().read('')).toBeUndefined()
  })
})
