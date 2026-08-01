import type { FeatureContract } from './types'
import { assertSendPayload, buildActionIndex, checkReceivePayload } from './payload-validation'

const contract: FeatureContract = {
  emitted: [
    { type: 'setTimezone', schema: { type: 'object', properties: { tz: { type: 'string' } }, required: ['tz'] } },
    { type: 'reset' },
  ],
  accepted: [
    { type: 'timeUpdated', schema: { type: 'object', properties: { iso: { type: 'string' } }, required: ['iso'] } },
    { type: 'ping' },
  ],
}

describe('buildActionIndex', () => {
  it('indexes actions by type for each direction', () => {
    const index = buildActionIndex(contract)
    expect({ send: index.emitted.get('setTimezone')?.type, receive: index.accepted.get('timeUpdated')?.type }).toEqual({
      send: 'setTimezone',
      receive: 'timeUpdated',
    })
  })
})

describe('assertSendPayload', () => {
  const index = buildActionIndex(contract)

  it('accepts a payload satisfying the action schema', () => {
    expect(() => assertSendPayload(index, 'setTimezone', { tz: 'UTC' })).not.toThrow()
  })

  it('throws an error naming the action on a schema violation', () => {
    expect(() => assertSendPayload(index, 'setTimezone', {})).toThrow("Invalid payload for action 'setTimezone'")
  })

  it('embeds the schema errors in the thrown message', () => {
    expect(() => assertSendPayload(index, 'setTimezone', {})).toThrow('Missing required property: tz')
  })

  it('passes a schema-less action through unchanged', () => {
    expect(() => assertSendPayload(index, 'reset', { anything: true })).not.toThrow()
  })

  it('passes a type the contract does not list through unchanged', () => {
    expect(() => assertSendPayload(index, 'unlisted', {})).not.toThrow()
  })

  it('consults only the emitted direction', () => {
    expect(() => assertSendPayload(index, 'timeUpdated', {})).not.toThrow()
  })
})

describe('checkReceivePayload', () => {
  const index = buildActionIndex(contract)

  it('reports valid for a payload satisfying the action schema', () => {
    expect(checkReceivePayload(index, 'timeUpdated', { iso: '2026-07-26T00:00:00Z' })).toEqual(expect.objectContaining({ valid: true }))
  })

  it('returns the schema errors for an invalid payload', () => {
    expect(checkReceivePayload(index, 'timeUpdated', {})).toEqual({
      valid: false,
      errors: [expect.objectContaining({ message: 'Missing required property: iso' })],
    })
  })

  it('reports valid for a schema-less action', () => {
    expect(checkReceivePayload(index, 'ping', { anything: true })).toEqual({ valid: true, errors: [] })
  })

  it('reports valid for a type the contract does not list', () => {
    expect(checkReceivePayload(index, 'unlisted', {})).toEqual({ valid: true, errors: [] })
  })

  it('consults only the accepted direction', () => {
    expect(checkReceivePayload(index, 'setTimezone', {})).toEqual({ valid: true, errors: [] })
  })
})
