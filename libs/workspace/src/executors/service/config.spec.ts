import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { create } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it } from '@hyperfrontend/testing'
import { checkServiceConfig, loadServiceConfig } from './config'

const NOT_JSON = (path: string): { code: string; path: string; message: string } => ({
  code: 'immutable-not-json',
  path,
  message: `${path} must be a JSON value: a string, a finite number, a boolean, null, an array or a plain object.`,
})

/** A value that is an object and not a plain one. */
class Limits {
  /** A member of its own. */
  names = 3
}

/**
 * An object nested inside itself a number of times.
 *
 * @param levels - How many objects enclose the innermost value
 * @returns The outermost object
 */
function nested(levels: number): Record<string, unknown> {
  let value: Record<string, unknown> = { leaf: true }
  for (let level = 1; level < levels; level += 1) value = { inner: value }
  return value
}

/**
 * The message a load rejects with.
 *
 * @param loaded - What importing the file gives
 * @returns The message
 */
async function refused(loaded: Promise<unknown>): Promise<string> {
  try {
    await loadServiceConfig('/repo/apps/hello/service.config.ts', 'apps/hello/service.config.ts', () => loaded)
    return ''
  } catch (error) {
    return (error as Error).message
  }
}

describe('checkServiceConfig', () => {
  it('accepts an empty object', () => {
    expect(checkServiceConfig({})).toEqual([])
  })

  it('accepts a section of JSON values', () => {
    expect(
      checkServiceConfig({ immutable: { greeting: 'Hello', limits: { names: 3, open: true, none: null }, origins: ['a', 'b'] } })
    ).toEqual([])
  })

  it('accepts a section that is stated as undefined, as one that was omitted', () => {
    expect(checkServiceConfig({ immutable: undefined })).toEqual([])
  })

  it('accepts an object without a prototype', () => {
    expect(checkServiceConfig({ immutable: { limits: create(null) } })).toEqual([])
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a text', 'immutable'],
    ['a class instance', new Limits()],
  ])('refuses a default export that is %s, alone', (_, value) => {
    expect(checkServiceConfig(value)).toEqual([
      { code: 'config-not-object', path: '', message: 'the default export must be a plain object.' },
    ])
  })

  it('refuses an unknown member', () => {
    expect(checkServiceConfig({ routes: [] })).toEqual([
      { code: 'config-unknown-member', path: 'routes', message: 'the configuration has an unknown member "routes": it takes immutable.' },
    ])
  })

  it.each([
    ['an array', []],
    ['null', null],
    ['a text', 'section'],
    ['a class instance', new Limits()],
  ])('refuses a section that is %s', (_, immutable) => {
    expect(checkServiceConfig({ immutable })).toEqual([
      { code: 'immutable-not-object', path: 'immutable', message: '"immutable" must be a plain object.' },
    ])
  })

  it.each([
    ['a Date', new Date(0)],
    ['a Map', createMap()],
    ['a class instance', new Limits()],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['an infinity', Number.POSITIVE_INFINITY],
    ['a BigInt', 1n],
    ['a function', () => 1],
    ['a symbol', Symbol.iterator],
  ])('refuses %s as a member of the section', (_, value) => {
    expect(checkServiceConfig({ immutable: { limits: { names: value } } })).toEqual([NOT_JSON('immutable.limits.names')])
  })

  it('refuses undefined in an array, by its index', () => {
    expect(checkServiceConfig({ immutable: { origins: ['a', 'b', undefined] } })).toEqual([NOT_JSON('immutable.origins[2]')])
  })

  it('refuses a hole in an array, by its index', () => {
    const origins: string[] = []
    origins[0] = 'a'
    origins[2] = 'c'
    expect(checkServiceConfig({ immutable: { origins } })).toEqual([NOT_JSON('immutable.origins[1]')])
  })

  it('refuses a member an array holds beside its elements, one named toJSON included', () => {
    const origins: string[] & { toJSON?: () => string; 'a note'?: string } = ['a', 'b']
    origins.toJSON = () => 'replaced'
    origins['a note'] = 'kept apart'
    expect(checkServiceConfig({ immutable: { origins } })).toEqual([
      NOT_JSON('immutable.origins.toJSON'),
      NOT_JSON('immutable.origins["a note"]'),
    ])
  })

  it('writes a key that is not an identifier in brackets', () => {
    expect(checkServiceConfig({ immutable: { 'a key': { 'b-c': undefined } } })).toEqual([NOT_JSON('immutable["a key"]["b-c"]')])
  })

  it('accepts a section nested 32 levels deep', () => {
    expect(checkServiceConfig({ immutable: nested(32) })).toEqual([])
  })

  it('refuses a section nested deeper than 32 levels', () => {
    expect(checkServiceConfig({ immutable: nested(33) })).toEqual([
      {
        code: 'immutable-too-deep',
        path: `immutable${'.inner'.repeat(32)}`,
        message: `immutable${'.inner'.repeat(32)} nests deeper than 32 levels.`,
      },
    ])
  })

  it('refuses a cycle as a section that nests too deep', () => {
    const section: Record<string, unknown> = {}
    section['self'] = section
    expect(checkServiceConfig({ immutable: section }).map((issue) => issue.code)).toEqual(['immutable-too-deep'])
  })

  it('reports several problems at once, in document order', () => {
    expect(
      checkServiceConfig({ before: 1, immutable: { first: undefined, list: [1n], last: new Date(0) }, after: 2 }).map((issue) => issue.path)
    ).toEqual(['before', 'immutable.first', 'immutable.list[0]', 'immutable.last', 'after'])
  })

  it('prints no value in any message', () => {
    expect(
      checkServiceConfig({ immutable: { token: Symbol('secret-marker'), when: new Date('secret-marker'), fn: () => 'secret-marker' } })
        .map((issue) => issue.message)
        .join('\n')
    ).not.toContain('secret-marker')
  })
})

describe('loadServiceConfig', () => {
  it('reads the default export', async () => {
    expect(
      await loadServiceConfig('/repo/apps/hello/service.config.ts', 'apps/hello/service.config.ts', () =>
        promiseResolve({ default: { immutable: { greeting: 'Hello' } } })
      )
    ).toEqual({ immutable: { greeting: 'Hello' } })
  })

  it('imports the file it is given', async () => {
    const imported: string[] = []
    await loadServiceConfig('/repo/apps/hello/service.config.ts', 'apps/hello/service.config.ts', (file) => {
      imported.push(file)
      return promiseResolve({ default: {} })
    })
    expect(imported).toEqual(['/repo/apps/hello/service.config.ts'])
  })

  it('reports a module that throws with the name of the file', async () => {
    expect(await refused(promiseReject(createError('no such variable')))).toMatch(
      /^apps\/hello\/service\.config\.ts: Error: no such variable/
    )
  })

  it('reports a module with no default export as one that exports no object', async () => {
    expect(await refused(promiseResolve({}))).toBe(
      'apps/hello/service.config.ts: invalid service configuration:\n  - the default export must be a plain object.'
    )
  })

  it('lists every problem of the export under the name of the file', async () => {
    expect(await refused(promiseResolve({ default: { immutable: { since: new Date(0) }, routes: [] } }))).toBe(
      [
        'apps/hello/service.config.ts: invalid service configuration:',
        '  - immutable.since must be a JSON value: a string, a finite number, a boolean, null, an array or a plain object.',
        '  - the configuration has an unknown member "routes": it takes immutable.',
      ].join('\n')
    )
  })
})
