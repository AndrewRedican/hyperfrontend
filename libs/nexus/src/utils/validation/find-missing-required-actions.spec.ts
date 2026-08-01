import type { IChannelContract } from '../../types/contract'
import { findMissingRequiredActions } from './find-missing-required-actions'

describe('findMissingRequiredActions', () => {
  const contract = (accepted: Array<{ type: string; required?: boolean }>, emitted: string[]): IChannelContract => ({
    accepted,
    emitted: emitted.map((type) => ({ type })),
  })

  it('returns nothing when no accepted entries are flagged required', () => {
    expect(findMissingRequiredActions(contract([{ type: 'ping' }], []), contract([], []))).toEqual([])
  })

  it('returns nothing when the peer emits every required type', () => {
    expect(findMissingRequiredActions(contract([{ type: 'ping', required: true }], []), contract([], ['ping', 'extra']))).toEqual([])
  })

  it('returns the required types the peer does not emit', () => {
    expect(
      findMissingRequiredActions(
        contract(
          [
            { type: 'ping', required: true },
            { type: 'pong', required: true },
          ],
          []
        ),
        contract([], ['pong'])
      )
    ).toEqual(['ping'])
  })

  it('accepts a peer that emits types outside the own vocabulary', () => {
    expect(findMissingRequiredActions(contract([{ type: 'ping', required: true }], []), contract([], ['ping', 'unknown-type']))).toEqual([])
  })

  it('ignores unflagged accepted entries the peer never emits', () => {
    expect(findMissingRequiredActions(contract([{ type: 'optional-input' }], []), contract([], []))).toEqual([])
  })

  it('ignores required flags on the own emitted list', () => {
    const own: IChannelContract = { accepted: [], emitted: [{ type: 'out', required: true }] }
    expect(findMissingRequiredActions(own, contract([], []))).toEqual([])
  })
})
