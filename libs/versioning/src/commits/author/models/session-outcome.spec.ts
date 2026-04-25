import { SessionStatus } from './session-outcome'

describe('SessionStatus', () => {
  it('exposes committed and cancelled terminal states', () => {
    expect(SessionStatus).toEqual({ Committed: 'committed', Cancelled: 'cancelled' })
  })
})
