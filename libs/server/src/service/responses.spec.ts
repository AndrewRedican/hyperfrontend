import { describe, expect, it } from '@hyperfrontend/testing'
import { jsonResponse } from './responses'

const REFUSAL = 'jsonResponse: the value cannot be represented as JSON.'

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

describe('jsonResponse', () => {
  it('carries the status it is given', () => {
    expect(jsonResponse(201, { created: true }).status).toBe(201)
  })

  it('sets the JSON content type', () => {
    expect(jsonResponse(200, { ok: true }).headers).toEqual({ 'Content-Type': 'application/json; charset=utf-8' })
  })

  it('writes the value as UTF-8 JSON', () => {
    expect(jsonResponse(200, { message: 'Hello, wörld' }).body).toEqual(Buffer.from('{"message":"Hello, wörld"}', 'utf8'))
  })

  it('writes null as JSON', () => {
    expect(jsonResponse(200, null).body?.toString()).toBe('null')
  })

  it('adds the headers it is given after the content type', () => {
    expect(Object.entries(jsonResponse(200, {}, { 'Cache-Control': 'no-store', ETag: 'W/"1"' }).headers)).toEqual([
      ['Content-Type', 'application/json; charset=utf-8'],
      ['Cache-Control', 'no-store'],
      ['ETag', 'W/"1"'],
    ])
  })

  it('lets a content type given in another spelling replace the default', () => {
    expect(jsonResponse(200, {}, { 'content-type': 'application/problem+json' }).headers).toEqual({
      'content-type': 'application/problem+json',
    })
  })

  it('does not mutate the headers it is given', () => {
    const headers = Object.freeze({ 'content-type': 'application/problem+json' })
    jsonResponse(200, {}, headers)
    expect(headers).toEqual({ 'content-type': 'application/problem+json' })
  })

  it('does not judge the status', () => {
    expect(jsonResponse(99, {}).status).toBe(99)
  })

  it('prints a value by its own toJSON, so a wrapped secret stays wrapped', () => {
    const secret = { reveal: () => 'marker-secret-value', toJSON: () => '[secret]' }
    expect(jsonResponse(200, { key: secret }).body?.toString()).toBe('{"key":"[secret]"}')
  })

  it.each([
    ['undefined', undefined],
    ['a function', () => 'value'],
    ['a symbol', Symbol('value')],
    ['a BigInt', BigInt(1)],
  ])('refuses %s', (_label, value) => {
    expect(thrownBy(() => jsonResponse(200, value))).toEqual({ type: 'TypeError', message: REFUSAL })
  })

  it('refuses a value that holds itself', () => {
    const cycle: Record<string, unknown> = { name: 'marker-cycle' }
    cycle['self'] = cycle
    expect(thrownBy(() => jsonResponse(200, cycle))).toEqual({ type: 'TypeError', message: REFUSAL })
  })

  it('drops the message of a toJSON that throws', () => {
    const hostile = {
      toJSON: () => {
        throw new Error('marker-hostile-message')
      },
    }
    expect(thrownBy(() => jsonResponse(200, hostile))).toEqual({ type: 'TypeError', message: REFUSAL })
  })
})
