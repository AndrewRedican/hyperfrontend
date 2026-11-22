import type { EnvironmentShape } from './contract'
import type { Reader, Secret } from './readers'
import { inspect } from 'node:util'
import { describe, expect, flushPromises, it, jest } from '@hyperfrontend/testing'
import { defineEnvironment, optional, required } from './contract'
import { asPort, asSecret, asText } from './readers'

// note: A string planted wherever a value could leak from; nothing the module produces may contain it.
const MARKER = 'marker-7f3a9c'

const GROUP_LINE = 'a group must be a plain object of variables, and its name must not be "__proto__".'
const NAME_LINE = 'a variable name must be upper-case letters, digits and "_", starting with a letter.'
const VARIABLE_LINE = 'not a variable; build it with required() or optional().'

/**
 * Declares the environment of the hello service, anew for each test.
 *
 * @returns The contract over two groups: a port and a host with fallbacks, a greeting and a key without.
 */
function helloEnvironment() {
  return defineEnvironment({
    http: { PORT: optional(asPort({ allowZero: true }), 8080), HOST: optional(asText(), '0.0.0.0') },
    hello: { HELLO_GREETING: required(asText()), HELLO_KEY: required(asSecret()) },
  })
}

/**
 * Hands a deliberately wrong definition to `defineEnvironment`, which the types would refuse.
 *
 * @param shape - The definition, as a caller without types could write it.
 * @returns A call that defines it.
 */
function defining(shape: unknown): () => unknown {
  return () => defineEnvironment(shape as EnvironmentShape)
}

/**
 * Builds a reader out of one function, described as text.
 *
 * @param read - What the reader does with a raw value.
 * @returns The reader, as a consumer would write one.
 */
function readerOf(read: (raw: string) => unknown): Reader<string> {
  return { expected: 'a value this reader accepts', secret: false, read: read as Reader<string>['read'] }
}

describe('required', () => {
  it('builds a variable that must be set', () => {
    const reader = asText()
    expect(required(reader)).toStrictEqual({ reader, required: true, fallback: undefined })
  })

  it('freezes the variable', () => {
    expect(Object.isFrozen(required(asText()))).toBe(true)
  })
})

describe('optional', () => {
  it('builds a variable that may be unset, with its fallback as given', () => {
    const reader = asPort()
    expect(optional(reader, 8080)).toStrictEqual({ reader, required: false, fallback: 8080 })
  })

  it('accepts a fallback of nothing', () => {
    const reader = asText()
    expect(optional<string | undefined>(reader, undefined)).toStrictEqual({ reader, required: false, fallback: undefined })
  })

  it('freezes the variable', () => {
    expect(Object.isFrozen(optional(asText(), 'fallback'))).toBe(true)
  })
})

describe('defineEnvironment', () => {
  it('accepts an empty shape', () => {
    expect(defineEnvironment({}).variables).toEqual([])
  })

  it('accepts a group without a prototype', () => {
    const group = Object.assign(Object.create(null), { GREETING: required(asText()) })
    expect(defineEnvironment({ hello: group }).variables).toEqual([expect.objectContaining({ name: 'GREETING', group: 'hello' })])
  })

  it('accepts the same variables spread into two contracts', () => {
    const http = { PORT: optional(asPort(), 8080) }
    expect([defineEnvironment({ http }).variables, defineEnvironment({ http, hello: {} }).variables]).toEqual([
      [expect.objectContaining({ name: 'PORT' })],
      [expect.objectContaining({ name: 'PORT' })],
    ])
  })

  it('lists every variable in declaration order, with no value and no fallback', () => {
    expect(helloEnvironment().variables).toStrictEqual([
      { name: 'PORT', group: 'http', required: false, secret: false, expected: 'an integer between 0 and 65535' },
      { name: 'HOST', group: 'http', required: false, secret: false, expected: 'non-empty text' },
      { name: 'HELLO_GREETING', group: 'hello', required: true, secret: false, expected: 'non-empty text' },
      { name: 'HELLO_KEY', group: 'hello', required: true, secret: true, expected: 'a secret of at least 16 characters' },
    ])
  })

  it('freezes the list and each description', () => {
    const { variables } = helloEnvironment()
    expect([variables, ...variables].filter((part) => !Object.isFrozen(part))).toEqual([])
  })

  it('freezes the contract', () => {
    expect(Object.isFrozen(helloEnvironment())).toBe(true)
  })

  it('keeps what was declared when the shape is changed afterwards', () => {
    const shape = { http: { PORT: required(asPort()) } as Record<string, ReturnType<typeof required>> }
    const environment = defineEnvironment(shape)
    shape.http['LATER'] = required(asText())
    expect(environment.check({ PORT: '8080' })).toEqual([])
  })

  it('names every problem in one error, in declaration order', () => {
    const shape = {
      http: { PORT: optional(asPort(), 8080), 'lower-case': required(asText()), HOST: MARKER },
      list: [],
      ...JSON.parse('{"__proto__":{"NAME":1}}'),
      hello: { PORT: required(asPort()), HELLO_KEY: optional(asSecret(), undefined), '9LIVES': null },
    }
    expect(defining(shape)).toThrow(
      new Error(
        [
          'Invalid environment definition:',
          `  - http.lower-case: ${NAME_LINE}`,
          `  - http.HOST: ${VARIABLE_LINE}`,
          `  - list: ${GROUP_LINE}`,
          `  - __proto__: ${GROUP_LINE}`,
          '  - PORT is declared in "http" and in "hello".',
          '  - HELLO_KEY (hello) is a secret and cannot have a fallback.',
          `  - hello.9LIVES: ${NAME_LINE}`,
          `  - hello.9LIVES: ${VARIABLE_LINE}`,
        ].join('\n')
      )
    )
  })

  it('throws a plain error for a faulty definition', () => {
    expect(defining({ list: [] })).toThrow({ name: 'Error' })
  })

  it.each([[null], [[]], [new Map()], [new Date(0)], ['PORT'], [8080], [undefined]])('refuses the group %p', (group: unknown) => {
    expect(defining({ http: group })).toThrow(new Error(`Invalid environment definition:\n  - http: ${GROUP_LINE}`))
  })

  it('refuses a group named __proto__ even when it is a plain object of variables', () => {
    const shape = Object.defineProperty({}, '__proto__', { value: { PORT: required(asPort()) }, enumerable: true })
    expect(defining(shape)).toThrow(new Error(`Invalid environment definition:\n  - __proto__: ${GROUP_LINE}`))
  })

  it.each([['port'], ['Port'], ['1PORT'], ['_PORT'], ['PO-RT'], ['PORT '], ['PORT\n'], ['']])(
    'refuses the variable name %p',
    (name: string) => {
      expect(defining({ http: { [name]: required(asPort()) } })).toThrow(
        new Error(`Invalid environment definition:\n  - http.${name}: ${NAME_LINE}`)
      )
    }
  )

  it.each([
    [null],
    ['PORT'],
    [8080],
    [{}],
    [asPort()],
    [{ reader: asPort() }],
    [{ reader: asPort(), required: 'yes' }],
    [{ reader: null, required: true }],
    [{ reader: 'asPort', required: true }],
    [{ reader: { secret: false, read: () => 1 }, required: true }],
    [{ reader: { expected: 'a port', read: () => 1 }, required: true }],
    [{ reader: { expected: 'a port', secret: false }, required: true }],
    [{ reader: { expected: 'a port', secret: false, read: 'asPort' }, required: true }],
  ])('refuses %p, which is not a variable', (variable: unknown) => {
    expect(defining({ http: { PORT: variable } })).toThrow(new Error(`Invalid environment definition:\n  - http.PORT: ${VARIABLE_LINE}`))
  })

  it('accepts a variable written as a literal around a reader of the consumer', () => {
    const variable = { reader: readerOf((raw) => raw), required: true, fallback: undefined }
    expect(defineEnvironment({ hello: { GREETING: variable } }).load({ GREETING: 'Hello' })).toEqual({ hello: { GREETING: 'Hello' } })
  })

  it('names each later group that repeats a variable beside the first', () => {
    const shape = { one: { PORT: required(asPort()) }, two: { PORT: required(asPort()) }, three: { PORT: required(asPort()) } }
    expect(defining(shape)).toThrow(
      new Error(
        'Invalid environment definition:\n  - PORT is declared in "one" and in "two".\n  - PORT is declared in "one" and in "three".'
      )
    )
  })

  it('refuses a secret with a fallback', () => {
    const fallback = asSecret().read(`${MARKER}-0123456789`) as Secret
    expect(defining({ keys: { SERVICE_KEY: optional(asSecret(), fallback) } })).toThrow(
      new Error('Invalid environment definition:\n  - SERVICE_KEY (keys) is a secret and cannot have a fallback.')
    )
  })

  it('accepts a secret that must be set', () => {
    expect(defineEnvironment({ keys: { SERVICE_KEY: required(asSecret()) } }).variables).toEqual([
      expect.objectContaining({ secret: true }),
    ])
  })
})

describe('check', () => {
  it('finds nothing in a valid environment', () => {
    expect(helloEnvironment().check({ PORT: '0', HOST: '127.0.0.1', HELLO_GREETING: 'Hello', HELLO_KEY: '0123456789abcdef' })).toEqual([])
  })

  it('finds nothing when only the optional variables are unset', () => {
    expect(helloEnvironment().check({ HELLO_GREETING: 'Hello', HELLO_KEY: '0123456789abcdef' })).toEqual([])
  })

  it('reports an unset required variable as missing', () => {
    expect(helloEnvironment().check({ HELLO_KEY: '0123456789abcdef' })).toStrictEqual([
      { name: 'HELLO_GREETING', group: 'hello', problem: 'missing', expected: 'non-empty text' },
    ])
  })

  it('reads the empty string as unset', () => {
    expect(helloEnvironment().check({ PORT: '', HELLO_GREETING: '', HELLO_KEY: '0123456789abcdef' })).toStrictEqual([
      { name: 'HELLO_GREETING', group: 'hello', problem: 'missing', expected: 'non-empty text' },
    ])
  })

  it('reports a required value its reader refuses as malformed', () => {
    expect(helloEnvironment().check({ HELLO_GREETING: 'Hello', HELLO_KEY: 'too-short' })).toStrictEqual([
      { name: 'HELLO_KEY', group: 'hello', problem: 'malformed', expected: 'a secret of at least 16 characters' },
    ])
  })

  it('reports a set but malformed optional variable instead of falling back', () => {
    expect(helloEnvironment().check({ PORT: 'eighty', HELLO_GREETING: 'Hello', HELLO_KEY: '0123456789abcdef' })).toStrictEqual([
      { name: 'PORT', group: 'http', problem: 'malformed', expected: 'an integer between 0 and 65535' },
    ])
  })

  it('hands the reader the value untrimmed', () => {
    const read = (raw: string): string => raw
    const environment = defineEnvironment({ hello: { GREETING: required(readerOf(read)) } })
    expect(environment.load({ GREETING: '  Hello \n' }).hello.GREETING).toBe('  Hello \n')
  })

  it('reports a reader that throws as malformed', () => {
    const environment = defineEnvironment({
      hello: {
        GREETING: required(
          readerOf(() => {
            throw new Error(`refused ${MARKER}`)
          })
        ),
      },
    })
    expect(environment.check({ GREETING: 'Hello' })).toStrictEqual([
      { name: 'GREETING', group: 'hello', problem: 'malformed', expected: 'a value this reader accepts' },
    ])
  })

  it('reports a reader that returns a rejected promise as malformed, and handles the rejection', async () => {
    const environment = defineEnvironment({ hello: { GREETING: required(readerOf(() => Promise.reject(new Error(`refused ${MARKER}`)))) } })
    const issues = environment.check({ GREETING: 'Hello' })
    await flushPromises()
    expect(issues).toEqual([expect.objectContaining({ name: 'GREETING', problem: 'malformed' })])
  })

  it('reports a reader that returns a resolved promise as malformed', () => {
    const environment = defineEnvironment({
      hello: {
        GREETING: optional(
          readerOf(() => Promise.resolve('Hello')),
          'Hi'
        ),
      },
    })
    expect(environment.check({ GREETING: 'Hello' })).toEqual([expect.objectContaining({ name: 'GREETING', problem: 'malformed' })])
  })

  it('reports a reader whose result has a then that throws as malformed', () => {
    const thenable = {
      then: () => {
        throw new Error(`refused ${MARKER}`)
      },
    }
    const environment = defineEnvironment({ hello: { GREETING: required(readerOf(() => thenable)) } })
    expect(environment.check({ GREETING: 'Hello' })).toEqual([expect.objectContaining({ name: 'GREETING', problem: 'malformed' })])
  })

  it('accepts a result that is nothing like a promise, null included', () => {
    const environment = defineEnvironment({ hello: { GREETING: required(readerOf(() => null)) } })
    expect(environment.check({ GREETING: 'Hello' })).toEqual([])
  })

  it('ignores names the shape does not declare', () => {
    expect(helloEnvironment().check({ HELLO_GREETING: 'Hello', HELLO_KEY: '0123456789abcdef', PATH: '/usr/bin', port: 'eighty' })).toEqual(
      []
    )
  })

  it('lists the issues in declaration order', () => {
    expect(helloEnvironment().check({ HOST: '', PORT: '65536' })).toEqual([
      expect.objectContaining({ name: 'PORT', problem: 'malformed' }),
      expect.objectContaining({ name: 'HELLO_GREETING', problem: 'missing' }),
      expect.objectContaining({ name: 'HELLO_KEY', problem: 'missing' }),
    ])
  })

  it('freezes the list and each issue', () => {
    const issues = helloEnvironment().check({})
    expect([issues, ...issues].filter((part) => !Object.isFrozen(part))).toEqual([])
  })
})

describe('load', () => {
  it('returns typed values under their group and name', () => {
    const values = helloEnvironment().load({ PORT: '0', HOST: '127.0.0.1', HELLO_GREETING: 'Hello', HELLO_KEY: '0123456789abcdef' })
    const port: number = values.http.PORT
    const host: string = values.http.HOST
    const greeting: string = values.hello.HELLO_GREETING
    const key: Secret = values.hello.HELLO_KEY
    expect({ port, host, greeting, key: key.reveal() }).toEqual({ port: 0, host: '127.0.0.1', greeting: 'Hello', key: '0123456789abcdef' })
  })

  it('gives an unset optional variable its fallback as given', () => {
    const fallback = { greeting: 'Hi' }
    const environment = defineEnvironment({ hello: { GREETING: optional(readerOf((raw) => raw) as Reader<unknown>, fallback) } })
    expect(environment.load({}).hello.GREETING).toBe(fallback)
  })

  it('gives an empty optional variable its fallback', () => {
    expect(helloEnvironment().load({ PORT: '', HELLO_GREETING: 'Hello', HELLO_KEY: '0123456789abcdef' }).http).toEqual({
      PORT: 8080,
      HOST: '0.0.0.0',
    })
  })

  it('gives an unset optional variable a fallback of nothing', () => {
    const environment = defineEnvironment({ hello: { GREETING: optional<string | undefined>(asText(), undefined) } })
    expect(environment.load({})).toStrictEqual({ hello: { GREETING: undefined } })
  })

  it('returns an empty group as an empty object', () => {
    expect(defineEnvironment({ http: {}, hello: { GREETING: required(asText()) } }).load({ GREETING: 'Hello' })).toStrictEqual({
      http: {},
      hello: { GREETING: 'Hello' },
    })
  })

  it('freezes the values and each group', () => {
    const values = helloEnvironment().load({ HELLO_GREETING: 'Hello', HELLO_KEY: '0123456789abcdef' })
    expect([values, values.http, values.hello].filter((part) => !Object.isFrozen(part))).toEqual([])
  })

  it('asks each reader once', () => {
    const read = jest.fn((raw: string) => raw)
    defineEnvironment({ hello: { GREETING: required(readerOf(read)) } }).load({ GREETING: 'Hello' })
    expect(read.mock.calls).toEqual([['Hello']])
  })

  it('throws one error that lists every issue on a line of its own', () => {
    expect(() => helloEnvironment().load({ PORT: 'not-a-port' })).toThrow(
      new Error(
        [
          'Invalid environment:',
          '  - PORT (http) is malformed; expected an integer between 0 and 65535.',
          '  - HELLO_GREETING (hello) is missing; expected non-empty text.',
          '  - HELLO_KEY (hello) is missing; expected a secret of at least 16 characters.',
        ].join('\n')
      )
    )
  })

  it('names the error EnvironmentError', () => {
    expect(() => helloEnvironment().load({})).toThrow({ name: 'EnvironmentError' })
  })

  it('throws an instance of Error', () => {
    expect(() => helloEnvironment().load({})).toThrow(Error)
  })
})

describe('what the module prints', () => {
  it('holds no value, fallback or reader message for a faulty environment', () => {
    const environment = defineEnvironment({
      http: { PORT: required(asPort()), HOST: optional(asText(), `fallback-${MARKER}`) },
      keys: {
        SERVICE_KEY: required(asSecret()),
        SHORT_KEY: required(asSecret()),
        BROKEN: required(
          readerOf(() => {
            throw new Error(`refused ${MARKER}`)
          })
        ),
      },
    })
    const env = { PORT: MARKER, SERVICE_KEY: `${MARKER}-0123456789abcdef`, SHORT_KEY: MARKER, BROKEN: MARKER, UNDECLARED: MARKER }
    let thrown: unknown
    try {
      environment.load(env)
    } catch (error) {
      thrown = error
    }
    const error = thrown as Error
    const printed = [
      JSON.stringify(environment.variables),
      JSON.stringify(environment.check(env)),
      error.name,
      error.message,
      String(error.stack),
      String(error),
      inspect(error, { showHidden: true, depth: null }),
    ]
    expect(printed.join('\n')).not.toContain(MARKER)
  })

  it('holds no value of a faulty definition', () => {
    let thrown: unknown
    try {
      defineEnvironment({ http: { PORT: MARKER, HOST: { reader: MARKER, required: true } } } as unknown as EnvironmentShape)
    } catch (error) {
      thrown = error
    }
    expect(inspect(thrown, { showHidden: true, depth: null })).not.toContain(MARKER)
  })

  it('holds no secret once the values are loaded', () => {
    const values = defineEnvironment({ keys: { SERVICE_KEY: required(asSecret()) } }).load({ SERVICE_KEY: `${MARKER}-0123456789abcdef` })
    expect(
      [JSON.stringify(values), `${values.keys.SERVICE_KEY}`, inspect(values, { showHidden: true, depth: null })].join('\n')
    ).not.toContain(MARKER)
  })
})
