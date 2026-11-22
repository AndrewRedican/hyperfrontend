import type { FailureEvent, RequestEvent } from './events'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { duration, emitEvent, errorName, formatEvent } from './events'

/**
 * Builds a request event, a routed `GET` answered 200 unless fields say otherwise.
 *
 * @param fields - The fields that differ.
 * @returns A complete request event.
 */
const requestEvent = (fields: Partial<RequestEvent> = {}): RequestEvent => ({
  type: 'request',
  method: 'GET',
  route: 'hello',
  path: null,
  status: 200,
  outcome: 'sent',
  durationMs: 3,
  annotations: {},
  ...fields,
})

/**
 * Builds a failure event, a failed step of a routed `GET` unless fields say otherwise.
 *
 * @param fields - The fields that differ.
 * @returns A complete failure event.
 */
const failureEvent = (fields: Partial<FailureEvent> = {}): FailureEvent => ({
  type: 'failure',
  code: 'step-failed',
  name: 'TypeError',
  method: 'GET',
  route: 'hello',
  path: null,
  ...fields,
})

/**
 * Builds an error whose `name` is whatever the spec says, a non-string included.
 *
 * @param name - What the error carries under `name`.
 * @returns The error.
 */
const named = (name: unknown): Error => Object.assign(new Error('the message'), { name })

/**
 * Formats a request event that carries one annotation and returns what was written for its value.
 *
 * @param value - The annotated value.
 * @returns The text after `note=`.
 */
const written = (value: string | number | boolean): string =>
  formatEvent(requestEvent({ annotations: { note: value } })).split(' note=')[1] as string

describe('errorName', () => {
  it('names an error', () => {
    expect(errorName(new Error('the message'))).toBe('Error')
  })

  it('names a subclass of error', () => {
    expect(errorName(new RangeError('the message'))).toBe('RangeError')
  })

  it('names the abort error of an aborted signal', () => {
    const controller = new AbortController()
    controller.abort()
    expect(errorName(controller.signal.reason)).toBe('AbortError')
  })

  it('names an error whose name holds a dot, a dollar sign and an underscore', () => {
    expect(errorName(named('Store.$retry_2'))).toBe('Store.$retry_2')
  })

  it('names an error whose name has 64 characters', () => {
    expect(errorName(named('E'.repeat(64)))).toBe('E'.repeat(64))
  })

  it.each([
    ['a plain object that carries a name', { name: 'TypeError' }],
    ['an error whose name has a space', named('Type Error')],
    ['an error whose name has 65 characters', named('E'.repeat(65))],
    ['an error whose name starts with a digit', named('4xx')],
    ['an error whose name is empty', named('')],
    ['an error whose name ends with a line break', named('TypeError\n')],
    ['an error whose name is not a string', named(42)],
    ['null', null],
    ['undefined', undefined],
    ['a string', 'TypeError'],
    ['a function', () => 'TypeError'],
  ])('answers unknown for %s', (_title, value) => {
    expect(errorName(value)).toBe('unknown')
  })

  it('answers unknown for an error whose name is a getter that throws', () => {
    const error = Object.defineProperty(new Error('the message'), 'name', {
      get: () => {
        throw new Error('unreadable')
      },
    })
    expect(errorName(error)).toBe('unknown')
  })

  it('answers unknown for a proxy whose prototype cannot be read', () => {
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('unreadable')
        },
      }
    )
    expect(errorName(proxy)).toBe('unknown')
  })
})

describe('duration', () => {
  it('measures a positive difference', () => {
    expect(duration(1000, 1042)).toBe(42)
  })

  it('rounds a fraction to whole milliseconds', () => {
    expect([duration(0, 2.4), duration(0, 2.5)]).toEqual([2, 3])
  })

  it('answers zero when the clock stepped backwards', () => {
    expect(duration(1042, 1000)).toBe(0)
  })
})

describe('emitEvent', () => {
  it('hands the event to the sink', () => {
    const received: unknown[] = []
    const event = failureEvent()
    emitEvent((given) => void received.push(given), event)
    expect(received).toEqual([event])
  })

  it('stays silent without a sink', () => {
    expect(emitEvent(undefined, failureEvent())).toBeUndefined()
  })

  it('ignores a sink that throws', () => {
    const sink = (): void => {
      throw new Error('the sink failed')
    }
    expect(emitEvent(sink, failureEvent())).toBeUndefined()
  })

  it('ignores a sink that returns a promise that rejects', async () => {
    emitEvent(async () => {
      throw new Error('the shipper failed')
    }, failureEvent())
    // why: the runner fails this file on an unhandled rejection, so reaching the assertion is the proof
    expect(await flushPromises()).toBeUndefined()
  })

  it('never waits for a sink that returns a promise', () => {
    let settled = false
    const sink = async (): Promise<void> => {
      await flushPromises()
      settled = true
    }
    emitEvent(sink, failureEvent())
    expect(settled).toBe(false)
  })

  it('ignores a sink that returns a thenable whose then throws', () => {
    const thenable = {
      then: (): void => {
        throw new Error('the thenable failed')
      },
    }
    expect(emitEvent((() => thenable) as unknown as () => void, failureEvent())).toBeUndefined()
  })

  it('ignores a sink that returns an object whose then cannot be read', () => {
    const unreadable = Object.defineProperty({}, 'then', {
      get: () => {
        throw new Error('unreadable')
      },
    })
    expect(emitEvent((() => unreadable) as unknown as () => void, failureEvent())).toBeUndefined()
  })

  it.each([
    ['null', null],
    ['a number', 7],
    ['an object without a then', { ok: true }],
    ['an object whose then is not a function', { then: 'later' }],
  ])('accepts a sink that returns %s', (_title, returned) => {
    expect(emitEvent((() => returned) as unknown as () => void, failureEvent())).toBeUndefined()
  })
})

describe('formatEvent', () => {
  it('formats a routed request', () => {
    expect(formatEvent(requestEvent())).toBe('request method=GET route=hello status=200 outcome=sent ms=3')
  })

  it('formats a request no route claimed with its path and its annotations', () => {
    const event = requestEvent({ route: null, path: '/nothing', status: 404, durationMs: 1, annotations: { failure: 'not-found' } })
    expect(formatEvent(event)).toBe('request method=GET path=/nothing status=404 outcome=sent ms=1 failure=not-found')
  })

  it('quotes a path that holds a space', () => {
    const event = requestEvent({
      method: 'POST',
      route: null,
      path: '/a b',
      status: 413,
      durationMs: 2,
      annotations: { failure: 'body-too-large' },
    })
    expect(formatEvent(event)).toBe('request method=POST path="/a b" status=413 outcome=sent ms=2 failure=body-too-large')
  })

  it('formats a failure of a routed request', () => {
    expect(formatEvent(failureEvent())).toBe('failure code=step-failed name=TypeError method=GET route=hello')
  })

  it('formats a failure of a connection without the fields it lacks', () => {
    expect(formatEvent(failureEvent({ code: 'request-timeout', name: 'Error', method: null, route: null }))).toBe(
      'failure code=request-timeout name=Error'
    )
  })

  it('formats a failure of a request no route claimed with its path', () => {
    expect(formatEvent(failureEvent({ route: null, path: '/tickets/7' }))).toBe(
      'failure code=step-failed name=TypeError method=GET path=/tickets/7'
    )
  })

  it('formats a request whose target was refused with neither a route nor a path', () => {
    const event = requestEvent({ route: null, status: 400, annotations: { failure: 'malformed-target' } })
    expect(formatEvent(event)).toBe('request method=GET status=400 outcome=sent ms=3 failure=malformed-target')
  })

  it('writes the route and leaves the path out when an event carries both', () => {
    expect(formatEvent(requestEvent({ path: '/hello/world' }))).toBe('request method=GET route=hello status=200 outcome=sent ms=3')
  })

  it('writes annotations in the order of the object keys', () => {
    expect(formatEvent(requestEvent({ annotations: { subject: 'u1', failure: 'internal', attempt: 2 } }))).toBe(
      'request method=GET route=hello status=200 outcome=sent ms=3 subject=u1 failure=internal attempt=2'
    )
  })

  it('writes a boolean and a number bare', () => {
    expect([written(true), written(false), written(-1.5), written(0)]).toEqual(['true', 'false', '-1.5', '0'])
  })

  it('writes every character of the bare set bare', () => {
    expect(written('Az09_.:/@+-')).toBe('Az09_.:/@+-')
  })

  it('quotes an empty string', () => {
    expect(written('')).toBe('""')
  })

  it.each([
    ['an equals sign', 'a=b', '"a=b"'],
    ['a comma', 'a,b', '"a,b"'],
    ['a tilde, the last character left as it is', '~', '"~"'],
  ])('quotes a value that holds %s', (_title, value, expected) => {
    expect(written(value)).toBe(expected)
  })

  it.each([
    ['a line feed', 'a\nb', '"a\\u000ab"'],
    ['a carriage return', 'a\rb', '"a\\u000db"'],
    ['a tab', 'a\tb', '"a\\u0009b"'],
    ['a delete character', 'a\u007fb', '"a\\u007fb"'],
    ['a letter outside ASCII', 'w\u00f6rld', '"w\\u00f6rld"'],
    ['a line separator', 'a\u2028b', '"a\\u2028b"'],
    ['a right-to-left override', 'a\u202eb', '"a\\u202eb"'],
    ['a character outside the basic plane, one unit at a time', '\u{1f600}', '"\\ud83d\\ude00"'],
  ])('escapes %s', (_title, value, expected) => {
    expect(written(value)).toBe(expected)
  })

  it('escapes a quote and a backslash with a backslash', () => {
    expect(written('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"')
  })

  it('writes a value of 256 bare characters whole', () => {
    expect(written('a'.repeat(256))).toBe('a'.repeat(256))
  })

  it('cuts a longer value to 256 units and quotes it', () => {
    expect(written('a'.repeat(257))).toBe(`"${'a'.repeat(256)}"`)
  })

  it('cuts before it escapes, so a long value of escaped characters keeps 256 of them', () => {
    expect(written('"'.repeat(300))).toBe(`"${'\\"'.repeat(256)}"`)
  })

  it('quotes an annotation name that is not a bare word', () => {
    expect(formatEvent(requestEvent({ annotations: { 'a b': 1 } }))).toBe(
      'request method=GET route=hello status=200 outcome=sent ms=3 "a b"=1'
    )
  })

  it('never writes a line break', () => {
    const lines = [
      formatEvent(requestEvent({ method: 'GET\r\nX', route: 'a\nb', annotations: { 'c\nd': 'e\u2028f\u2029g\u0085h' } })),
      formatEvent(requestEvent({ route: null, path: '/a\nb' })),
      formatEvent(failureEvent({ code: 'a\nb', name: 'c\rd', method: 'e\nf', route: null, path: 'g\nh' })),
    ]
    expect(lines.filter((line) => /[\n\r\u0085\u2028\u2029]/.test(line))).toEqual([])
  })
})
