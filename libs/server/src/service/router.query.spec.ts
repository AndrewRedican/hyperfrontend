import type { BaseContext, Handler, ServiceRequest, Step } from './contract'
import type { Route } from './router'
import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { settle } from './pipeline'
import { jsonResponse } from './responses'
import { route, router } from './router'

/** What a spec asserts on after one request went through a router. */
interface Seen {
  /** The status of the response. */
  readonly status: number
  /** The `Allow` header of the response, when it has one. */
  readonly allow: string | undefined
  /** The body of the response as text, when it has one. */
  readonly body: string | undefined
  /** Every `annotate` call, in order. */
  readonly annotations: unknown[][]
}

// why: a router reads the methods of the running Node.js, so the list is replaced by one this spec changes, and both kinds of runtime are met on any version.
jest.mock('node:http', () => {
  const actual = jest.requireActual<typeof import('node:http')>('node:http')
  return { ...actual, METHODS: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'QUERY'] }
})

const UNPARSED_QUERY = 'the method QUERY is not parsed by this version of Node.js.'

/**
 * Takes QUERY out of the methods the runtime parses, as on a version of Node.js that came before the method; the list is whole again after the test.
 *
 * @returns Nothing.
 */
const forgetQuery = async (): Promise<void> => {
  const { METHODS } = await import('node:http')
  METHODS.splice(METHODS.indexOf('QUERY'), 1)
}

/**
 * Builds a handler that answers with its route's label.
 *
 * @param label - What the response body says.
 * @returns The handler.
 */
const says =
  (label: string): Handler =>
  () =>
    jsonResponse(200, label)

/**
 * Builds a router and returns the lines of the error it throws.
 *
 * @param table - The route table.
 * @returns The message split into lines, or an empty list when nothing was thrown.
 */
const refusal = (table: Record<string, Route>): string[] => {
  try {
    router(table)
    return []
  } catch (error) {
    return (error as Error).message.split(/\r?\n/)
  }
}

/**
 * Runs a router behind the boundary the listener puts around a pipeline, and gathers what a spec asserts on.
 *
 * @param step - The router.
 * @param method - The request method.
 * @param canonical - The canonical path.
 * @returns The status, the `Allow` header, the body as text and the annotations.
 */
const seen = async (step: Step, method: string, canonical: string): Promise<Seen> => {
  const annotations: unknown[][] = []
  const context: BaseContext = Object.freeze({
    signal: new AbortController().signal,
    client: Object.freeze({ address: '192.0.2.7' }),
    annotate: (name: string, value: string | number | boolean) => void annotations.push([name, value]),
    report: () => undefined,
  })
  const request = Object.freeze({
    method,
    url: canonical,
    headers: Object.freeze(Object.create(null)),
    path: canonical,
    query: Object.freeze({}),
    params: Object.freeze(Object.create(null)),
    body: Object.freeze({ length: null }),
  }) as unknown as ServiceRequest
  const response = await settle(() => step(request, context, () => Promise.resolve({ status: 404, headers: {}, body: null })), context)
  return { status: response.status, allow: response.headers['Allow'], body: response.body?.toString(), annotations }
}

afterEach(async () => {
  const { METHODS } = await import('node:http')
  if (!METHODS.includes('QUERY')) {
    METHODS.push('QUERY')
  }
})

describe('a router on a runtime whose HTTP parser knows QUERY', () => {
  it('accepts a QUERY route', () => {
    expect(refusal({ search: route('QUERY', '/tickets', says('search')) })).toEqual([])
  })

  it('dispatches a QUERY request to its route, beside a GET route of the same path', async () => {
    const step = router({ list: route('GET', '/tickets', says('list')), search: route('QUERY', '/tickets', says('search')) })
    expect(await seen(step, 'QUERY', '/tickets')).toEqual({
      status: 200,
      allow: undefined,
      body: '"search"',
      annotations: [['route', 'search']],
    })
  })

  it('never answers HEAD with a QUERY route', async () => {
    const step = router({ search: route('QUERY', '/tickets', says('search')) })
    expect(await seen(step, 'HEAD', '/tickets')).toEqual({
      status: 405,
      allow: 'QUERY',
      body: 'Method Not Allowed',
      annotations: [
        ['route', 'search'],
        ['failure', 'method-not-allowed'],
      ],
    })
  })

  it('never answers QUERY with a GET route', async () => {
    const step = router({ list: route('GET', '/tickets', says('list')) })
    expect((await seen(step, 'QUERY', '/tickets')).allow).toBe('GET, HEAD')
  })

  it('lists QUERY in Allow between DELETE and OPTIONS for a path that has it', async () => {
    const step = router({
      a: route('OPTIONS', '/t', says('a')),
      b: route('QUERY', '/t', says('b')),
      c: route('DELETE', '/t', says('c')),
      d: route('GET', '/t', says('d')),
    })
    expect((await seen(step, 'POST', '/t')).allow).toBe('GET, HEAD, DELETE, QUERY, OPTIONS')
  })

  it('refuses two QUERY routes of one shape as it does those of any method', () => {
    expect(
      refusal({ find: route('QUERY', '/tickets/:id', says('find')), search: route('QUERY', '/tickets/:key', says('search')) })
    ).toEqual(['Invalid routes:', '  - find and search: the same method and shape.'])
  })
})

describe('a router on a runtime whose HTTP parser does not know QUERY', () => {
  it('refuses a QUERY route, naming the route and the method', async () => {
    await forgetQuery()
    expect(refusal({ search: route('QUERY', '/tickets', says('search')) })).toEqual(['Invalid routes:', `  - search: ${UNPARSED_QUERY}`])
  })

  it('accepts a table without a QUERY route', async () => {
    await forgetQuery()
    expect(refusal({ list: route('GET', '/tickets', says('list')), create: route('POST', '/tickets', says('create')) })).toEqual([])
  })

  it('names every other fault of the route after the method', async () => {
    await forgetQuery()
    expect(refusal({ search: route('QUERY', 'tickets', says('search'), { timeoutMs: 0 }) })).toEqual([
      'Invalid routes:',
      `  - search: ${UNPARSED_QUERY}`,
      '  - search: the pattern must start with "/".',
      '  - search: "timeoutMs" must be a positive integer.',
    ])
  })

  it('still names two QUERY routes of one shape', async () => {
    await forgetQuery()
    expect(
      refusal({ find: route('QUERY', '/tickets/:id', says('find')), search: route('QUERY', '/tickets/:key', says('search')) })
    ).toEqual([
      'Invalid routes:',
      `  - find: ${UNPARSED_QUERY}`,
      `  - search: ${UNPARSED_QUERY}`,
      '  - find and search: the same method and shape.',
    ])
  })
})
