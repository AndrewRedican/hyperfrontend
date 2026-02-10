import { OPEN, CLOSE, CANCEL, DENY, INVALID } from './event-types'

describe('constants/event-types', () => {
  it('exports OPEN event type', () => {
    expect(OPEN).toBe('open')
  })

  it('exports CLOSE event type', () => {
    expect(CLOSE).toBe('close')
  })

  it('exports CANCEL event type', () => {
    expect(CANCEL).toBe('cancel')
  })

  it('exports DENY event type', () => {
    expect(DENY).toBe('deny')
  })

  it('exports INVALID event type', () => {
    expect(INVALID).toBe('invalid')
  })

  it('uses const assertions for type narrowing', () => {
    const open: 'open' = OPEN
    const close: 'close' = CLOSE
    const cancel: 'cancel' = CANCEL
    const deny: 'deny' = DENY
    const invalid: 'invalid' = INVALID

    expect(open).toBe('open')
    expect(close).toBe('close')
    expect(cancel).toBe('cancel')
    expect(deny).toBe('deny')
    expect(invalid).toBe('invalid')
  })
})
