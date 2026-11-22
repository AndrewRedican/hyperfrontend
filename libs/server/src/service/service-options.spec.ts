import type { Step } from './contract'
import type { ServiceOptions } from './service'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveServiceOptions } from './service-options'

const answer: Step = () => ({ status: 204, headers: {}, body: null })

/**
 * Resolves options that differ from a valid minimum in the fields given, typed loosely so a spec can pass what the compiler refuses.
 *
 * @param fields - The fields to set or replace.
 * @returns What the resolver returned.
 */
const resolve = (fields: Record<string, unknown> = {}): ReturnType<typeof resolveServiceOptions> =>
  resolveServiceOptions({ steps: [answer], port: 8080, ...fields } as ServiceOptions)

/**
 * Lists the problems the resolver names for the given fields.
 *
 * @param fields - The fields to set or replace.
 * @returns The lines of the thrown error's message, or an empty list when nothing was thrown.
 */
const problems = (fields: Record<string, unknown>): string[] => {
  try {
    resolve(fields)
  } catch (error) {
    return (error as Error).message.split(/\r?\n/)
  }
  return []
}

const HEAD = 'Invalid service options:'
const POSITIVE = ['headersTimeoutMs', 'requestTimeoutMs', 'keepAliveTimeoutMs', 'writeIdleTimeoutMs']

describe('resolveServiceOptions', () => {
  describe('defaults', () => {
    it('fills every bound a service did not set', () => {
      expect(resolve()).toEqual({
        steps: [answer],
        port: 8080,
        host: undefined,
        bodyBytes: 65536,
        headersTimeoutMs: 10000,
        requestTimeoutMs: 60000,
        keepAliveTimeoutMs: 5000,
        writeIdleTimeoutMs: 30000,
        graceMs: 10000,
        trustedProxyHops: 0,
      })
    })

    it('keeps every bound a service set', () => {
      const given = {
        steps: [answer, answer],
        port: 0,
        host: '127.0.0.1',
        bodyBytes: 0,
        headersTimeoutMs: 1,
        requestTimeoutMs: 2147483647,
        keepAliveTimeoutMs: 1,
        writeIdleTimeoutMs: 2147483647,
        graceMs: 0,
        trustedProxyHops: 16,
      }
      expect(resolve(given)).toEqual(given)
    })

    it('returns a frozen object', () => {
      expect(Object.isFrozen(resolve())).toBe(true)
    })

    it('copies the steps, so a list changed afterwards does not change the service', () => {
      const steps = [answer]
      const resolved = resolve({ steps })
      steps.push(answer)
      expect(resolved.steps).toEqual([answer])
    })

    it('freezes the steps it keeps', () => {
      expect(Object.isFrozen(resolve().steps)).toBe(true)
    })

    it('accepts an empty pipeline', () => {
      expect(resolve({ steps: [] }).steps).toEqual([])
    })

    it('accepts the largest port', () => {
      expect(resolve({ port: 65535 }).port).toBe(65535)
    })

    it('accepts a grace of the largest timer', () => {
      expect(resolve({ graceMs: 2147483647 }).graceMs).toBe(2147483647)
    })
  })

  describe('validation', () => {
    it('throws a plain Error', () => {
      expect(() => resolve({ port: -1 })).toThrow(Error)
    })

    it.each([[undefined], ['not a list'], [[answer, 'not a step']], [{ length: 0 }]])('refuses steps given as %p', (steps) => {
      expect(problems({ steps })).toEqual([HEAD, '  - "steps" must be an array of functions.'])
    })

    it.each([[undefined], [-1], [65536], [80.5], ['8080'], [Number.NaN]])('refuses a port given as %p', (port) => {
      expect(problems({ port })).toEqual([HEAD, '  - "port" must be an integer between 0 and 65535.'])
    })

    it.each([[''], [0], [null]])('refuses a host given as %p', (host) => {
      expect(problems({ host })).toEqual([HEAD, '  - "host" must be a non-empty string.'])
    })

    it.each([[-1], [1.5], ['64'], [null], [Number.POSITIVE_INFINITY], [2 ** 53]])('refuses a body cap given as %p', (bodyBytes) => {
      expect(problems({ bodyBytes })).toEqual([HEAD, '  - "bodyBytes" must be a non-negative integer.'])
    })

    it.each(POSITIVE)('refuses a %s of zero', (name) => {
      expect(problems({ [name]: 0 })).toContain(`  - "${name}" must be a positive integer.`)
    })

    it.each(POSITIVE)('refuses a %s past the largest timer', (name) => {
      expect(problems({ [name]: 2147483648 })).toContain(`  - "${name}" must be a positive integer.`)
    })

    it.each(POSITIVE)('refuses a %s that is not a whole number', (name) => {
      expect(problems({ [name]: 1.5 })).toContain(`  - "${name}" must be a positive integer.`)
    })

    it.each(POSITIVE)('refuses a %s that is not a number', (name) => {
      expect(problems({ [name]: '1000' })).toContain(`  - "${name}" must be a positive integer.`)
    })

    it('refuses a header time equal to the request time', () => {
      expect(problems({ headersTimeoutMs: 500, requestTimeoutMs: 500 })).toEqual([
        HEAD,
        '  - "headersTimeoutMs" must be below "requestTimeoutMs".',
      ])
    })

    it('refuses a header time above the request time', () => {
      expect(problems({ headersTimeoutMs: 501, requestTimeoutMs: 500 })).toEqual([
        HEAD,
        '  - "headersTimeoutMs" must be below "requestTimeoutMs".',
      ])
    })

    it('compares a header time with the default request time', () => {
      expect(problems({ headersTimeoutMs: 60000 })).toEqual([HEAD, '  - "headersTimeoutMs" must be below "requestTimeoutMs".'])
    })

    it('compares a request time with the default header time', () => {
      expect(problems({ requestTimeoutMs: 10000 })).toEqual([HEAD, '  - "headersTimeoutMs" must be below "requestTimeoutMs".'])
    })

    it.each([[0], [2147483648], ['900']])('does not compare the two times when the header time is given as %p', (headersTimeoutMs) => {
      expect(problems({ headersTimeoutMs, requestTimeoutMs: 500 })).toEqual([HEAD, '  - "headersTimeoutMs" must be a positive integer.'])
    })

    it.each([[0], [Number.NaN], ['100']])('does not compare the two times when the request time is given as %p', (requestTimeoutMs) => {
      expect(problems({ headersTimeoutMs: 500, requestTimeoutMs })).toEqual([HEAD, '  - "requestTimeoutMs" must be a positive integer.'])
    })

    it.each([[-1], [2147483648], [0.5], ['0']])('refuses a grace given as %p', (graceMs) => {
      expect(problems({ graceMs })).toEqual([HEAD, '  - "graceMs" must be a non-negative integer.'])
    })

    it.each([[-1], [17], [1.5], [true]])('refuses trusted hops given as %p', (trustedProxyHops) => {
      expect(problems({ trustedProxyHops })).toEqual([HEAD, '  - "trustedProxyHops" must be an integer between 0 and 16.'])
    })

    it('names every problem in one error, in a fixed order', () => {
      expect(
        problems({
          trustedProxyHops: 17,
          graceMs: -1,
          writeIdleTimeoutMs: 0,
          keepAliveTimeoutMs: 0,
          requestTimeoutMs: 0,
          headersTimeoutMs: 0,
          bodyBytes: -1,
          host: '',
          port: 70000,
          steps: null,
        })
      ).toEqual([
        HEAD,
        '  - "steps" must be an array of functions.',
        '  - "port" must be an integer between 0 and 65535.',
        '  - "host" must be a non-empty string.',
        '  - "bodyBytes" must be a non-negative integer.',
        '  - "headersTimeoutMs" must be a positive integer.',
        '  - "requestTimeoutMs" must be a positive integer.',
        '  - "keepAliveTimeoutMs" must be a positive integer.',
        '  - "writeIdleTimeoutMs" must be a positive integer.',
        '  - "graceMs" must be a non-negative integer.',
        '  - "trustedProxyHops" must be an integer between 0 and 16.',
      ])
    })

    it('puts the comparison of the two times after the four time lines', () => {
      expect(problems({ headersTimeoutMs: 700, requestTimeoutMs: 600, keepAliveTimeoutMs: 0, graceMs: -1 })).toEqual([
        HEAD,
        '  - "keepAliveTimeoutMs" must be a positive integer.',
        '  - "headersTimeoutMs" must be below "requestTimeoutMs".',
        '  - "graceMs" must be a non-negative integer.',
      ])
    })

    it('never puts an offending value in the message', () => {
      expect(problems({ host: 0, port: 'marker-port', steps: 'marker-steps', bodyBytes: 'marker-bytes' }).join('\n')).not.toContain(
        'marker'
      )
    })
  })
})
