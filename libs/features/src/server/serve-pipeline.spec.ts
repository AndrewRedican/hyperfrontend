import type { ResolvedServeConfig } from './serve-config'
import type { ServeStep, ServeStepContext, StaticRequest } from './serve-pipeline'
import { describe, expect, it } from '@hyperfrontend/testing'
import { headerValue, plainResponse, runSteps } from './serve-pipeline'

const config: ResolvedServeConfig = { root: '/site', port: 4284, headers: [], log: false }

const request = (): StaticRequest => ({ method: 'GET', url: '/', headers: {} })

describe('plainResponse', () => {
  it('builds a plain-text response from a status and body text', () => {
    const response = plainResponse(404, 'Not Found')
    expect({ status: response.status, headers: response.headers, body: response.body?.toString() }).toEqual({
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Not Found',
    })
  })
})

describe('headerValue', () => {
  it('reads a header stored under the exact name', () => {
    expect(headerValue({ 'Content-Type': 'text/html' }, 'Content-Type')).toBe('text/html')
  })

  it('reads a header stored under a different case', () => {
    expect(headerValue({ 'content-type': 'text/html' }, 'Content-Type')).toBe('text/html')
  })

  it('skips non-matching names before the wanted one', () => {
    expect(headerValue({ ETag: 'W/"1"', Vary: 'Origin' }, 'vary')).toBe('Origin')
  })

  it('returns undefined for an absent header', () => {
    expect(headerValue({ ETag: 'W/"1"' }, 'Vary')).toBeUndefined()
  })

  it('returns undefined when there are no headers at all', () => {
    expect(headerValue({}, 'Vary')).toBeUndefined()
  })
})

describe('runSteps', () => {
  it('lets the first step answer without delegating', () => {
    const steps: ServeStep[] = [() => plainResponse(200, 'answered'), () => plainResponse(500, 'unreached')]
    const response = runSteps(steps, request(), { config })
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 200, body: 'answered' })
  })

  it('lets an outer step transform the inner answer', () => {
    const outer: ServeStep = (_request, _context, next) => {
      const response = next()
      return { ...response, headers: { ...response.headers, 'X-Outer': 'seen' } }
    }
    const inner: ServeStep = () => plainResponse(200, 'inner')
    const response = runSteps([outer, inner], request(), { config })
    expect({ status: response.status, outer: response.headers['X-Outer'], body: response.body?.toString() }).toEqual({
      status: 200,
      outer: 'seen',
      body: 'inner',
    })
  })

  it('shares the one context instance with every step', () => {
    const seen: ServeStepContext[] = []
    const record: ServeStep = (_request, context, next) => {
      seen.push(context)
      return next()
    }
    const context: ServeStepContext = { config }
    runSteps([record, record], request(), context)
    expect({ count: seen.length, first: seen[0] === context, second: seen[1] === context }).toEqual({ count: 2, first: true, second: true })
  })

  it('answers 404 when every step delegates past the end', () => {
    const passThrough: ServeStep = (_request, _context, next) => next()
    const response = runSteps([passThrough], request(), { config })
    expect({ status: response.status, body: response.body?.toString() }).toEqual({ status: 404, body: 'Not Found' })
  })

  it('answers 404 for an empty pipeline', () => {
    const response = runSteps([], request(), { config })
    expect(response.status).toBe(404)
  })
})
