import { describe, expect, it } from '@hyperfrontend/testing'
import {
  definitionProblems,
  FAULT_LIMIT,
  FLUSH_MS,
  FORCE_AFTER_MS,
  HOLD_MS,
  isStartedService,
  readDefinition,
  START_TIMEOUT_MS,
  STOP_TIMEOUT_MS,
} from './run-definition'

const ENVIRONMENT_LINE = '"environment" must be an environment contract; build it with defineEnvironment().'
const START_LINE = '"start" must be a function.'
const START_TIMEOUT_LINE = '"startTimeoutMs" must be a positive integer.'
const STOP_TIMEOUT_LINE = '"stopTimeoutMs" must be a positive integer.'

/**
 * Builds a definition that has no problem, with members replaced or added.
 *
 * @param members - What the case changes.
 * @returns The definition as a loose record, the way an untyped caller hands it over.
 */
const definition = (members: Record<string, unknown> = {}): Record<string, unknown> => ({
  environment: { check: () => [], load: () => ({}) },
  start: () => ({ close: async () => undefined }),
  ...members,
})

describe('the times and limits of a run', () => {
  it('gives a start thirty seconds and a stop fifteen', () => {
    expect({ start: START_TIMEOUT_MS, stop: STOP_TIMEOUT_MS }).toEqual({ start: 30000, stop: 15000 })
  })

  it('ignores a repeated signal for one second and waits two for the streams', () => {
    expect({ force: FORCE_AFTER_MS, flush: FLUSH_MS }).toEqual({ force: 1000, flush: 2000 })
  })

  it('holds a running service with the longest delay a timer takes', () => {
    expect(HOLD_MS).toBe(2 ** 31 - 1)
  })

  it('lets eight faults write a block while stopping', () => {
    expect(FAULT_LIMIT).toBe(8)
  })
})

describe('definitionProblems', () => {
  describe('accepts', () => {
    it('finds nothing wrong with a contract and a function', () => {
      expect(definitionProblems(definition())).toEqual([])
    })

    it('finds nothing wrong with both times at one millisecond', () => {
      expect(definitionProblems(definition({ startTimeoutMs: 1, stopTimeoutMs: 1 }))).toEqual([])
    })

    it('finds nothing wrong with both times at the longest a timer takes', () => {
      expect(definitionProblems(definition({ startTimeoutMs: 2147483647, stopTimeoutMs: 2147483647 }))).toEqual([])
    })

    it('leaves the immutable section unjudged, whatever it is', () => {
      expect(definitionProblems(definition({ immutable: () => undefined }))).toEqual([])
    })
  })

  describe('refuses', () => {
    it.each([null, undefined, 'a service', 7, () => undefined])('answers %s with the one line alone', (value) => {
      expect(definitionProblems(value)).toEqual(['the definition must be an object.'])
    })

    it('names an environment that has no check', () => {
      expect(definitionProblems(definition({ environment: { load: () => ({}) } }))).toEqual([ENVIRONMENT_LINE])
    })

    it('names an environment that has no load', () => {
      expect(definitionProblems(definition({ environment: { check: () => [] } }))).toEqual([ENVIRONMENT_LINE])
    })

    it.each([null, undefined, 'PORT'])('names an environment that is %s', (environment) => {
      expect(definitionProblems(definition({ environment }))).toEqual([ENVIRONMENT_LINE])
    })

    it('names an environment that is a function carrying both members', () => {
      const environment = Object.assign(() => undefined, { check: () => [], load: () => ({}) })
      expect(definitionProblems(definition({ environment }))).toEqual([ENVIRONMENT_LINE])
    })

    it('names a start that is a string', () => {
      expect(definitionProblems(definition({ start: 'listen' }))).toEqual([START_LINE])
    })

    it.each([0, 1.5, 2147483648, -1, '30000', null, Number.NaN])('names a start time of %s', (startTimeoutMs) => {
      expect(definitionProblems(definition({ startTimeoutMs }))).toEqual([START_TIMEOUT_LINE])
    })

    it.each([0, 1.5, 2147483648, -1, '15000', null, Number.NaN])('names a stop time of %s', (stopTimeoutMs) => {
      expect(definitionProblems(definition({ stopTimeoutMs }))).toEqual([STOP_TIMEOUT_LINE])
    })

    it('lists every problem in a fixed order', () => {
      expect(definitionProblems({ environment: {}, start: 1, stopTimeoutMs: 0, startTimeoutMs: 0 })).toEqual([
        ENVIRONMENT_LINE,
        START_LINE,
        START_TIMEOUT_LINE,
        STOP_TIMEOUT_LINE,
      ])
    })
  })
})

describe('readDefinition', () => {
  // how: Builds a definition whose named member is a getter, which a spread would read too early.
  const withGetter = (name: string, get: () => unknown): Record<string, unknown> => Object.defineProperty(definition(), name, { get })

  const boom = (): never => {
    throw new RangeError('a message that must not be printed')
  }

  it('gives the environment, the start function and the section as plain members', () => {
    const given = definition({ immutable: { greeting: 'Hello' } })
    expect(readDefinition(given).service).toEqual({
      environment: given['environment'],
      start: given['start'],
      immutable: given['immutable'],
    })
  })

  it('gives the default times when the definition names none', () => {
    const { startTimeoutMs, stopTimeoutMs } = readDefinition(definition())
    expect({ startTimeoutMs, stopTimeoutMs }).toEqual({ startTimeoutMs: 30000, stopTimeoutMs: 15000 })
  })

  it('gives the times the definition names', () => {
    const { startTimeoutMs, stopTimeoutMs } = readDefinition(definition({ startTimeoutMs: 5, stopTimeoutMs: 7 }))
    expect({ startTimeoutMs, stopTimeoutMs }).toEqual({ startTimeoutMs: 5, stopTimeoutMs: 7 })
  })

  it('gives no fields and no detail for a definition that can be run', () => {
    const { fields, detail } = readDefinition(definition())
    expect({ fields, detail }).toEqual({ fields: {}, detail: [] })
  })

  it('writes each problem of a faulty definition as a list item, with no service', () => {
    expect(readDefinition(definition({ start: 'listen', stopTimeoutMs: 0 }))).toEqual({
      service: null,
      startTimeoutMs: 30000,
      stopTimeoutMs: 15000,
      fields: {},
      detail: [`  - ${START_LINE}`, `  - ${STOP_TIMEOUT_LINE}`],
    })
  })

  it('answers a value that is no object with the one line alone', () => {
    expect(readDefinition(null).detail).toEqual(['  - the definition must be an object.'])
  })

  it.each(['environment', 'start', 'immutable', 'startTimeoutMs', 'stopTimeoutMs'])(
    'gives the name of what the %s getter threw, and nothing of its message',
    (name) => {
      expect(readDefinition(withGetter(name, boom))).toEqual({
        service: null,
        startTimeoutMs: 30000,
        stopTimeoutMs: 15000,
        fields: { name: 'RangeError' },
        detail: [],
      })
    }
  )

  it.each(['environment', 'start', 'immutable', 'startTimeoutMs', 'stopTimeoutMs'])('reads the %s member once', (name) => {
    const reads: string[] = []
    readDefinition(withGetter(name, () => (reads.push(name), undefined)))
    expect(reads).toEqual([name])
  })
})

describe('isStartedService', () => {
  /**
   * Stands in for a close function.
   *
   * @returns A promise that resolves at once.
   */
  const close = async (): Promise<void> => undefined

  it.each([
    ['a close alone', { close }],
    ['a close and the lowest port', { port: 1, close }],
    ['a close and the highest port', { port: 65535, close }],
    ['a close that is no async function', { close: () => undefined }],
    ['more members than it needs', { port: 8080, url: 'http://localhost:8080/', close }],
  ])('takes %s', (_name, value) => {
    expect(isStartedService(value)).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'started'],
    ['an object with no close', { port: 8080 }],
    ['a close that is no function', { close: 'now' }],
    ['a port of 0', { port: 0, close }],
    ['a port of 65536', { port: 65536, close }],
    ['a port that is no integer', { port: 80.5, close }],
    ['a port that is text', { port: '8080', close }],
    ['a port that is null', { port: null, close }],
    ['a function that carries a close', Object.assign(() => undefined, { close })],
  ])('refuses %s', (_name, value) => {
    expect(isStartedService(value)).toBe(false)
  })

  it('refuses a value whose close cannot be read', () => {
    const value = Object.defineProperty({}, 'close', {
      get: () => {
        throw new Error('a getter that throws')
      },
    })
    expect(isStartedService(value)).toBe(false)
  })
})
