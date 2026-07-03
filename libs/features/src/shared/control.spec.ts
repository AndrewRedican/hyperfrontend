import { ControlType, isControlType, withControlContract } from './control'

describe('isControlType', () => {
  it('recognizes a reserved control type', () => {
    expect(isControlType(ControlType.Beat)).toBe(true)
  })

  it('rejects a consumer message type', () => {
    expect(isControlType('timeUpdated')).toBe(false)
  })
})

describe('withControlContract', () => {
  it('adds the control types to the emitted actions', () => {
    expect(withControlContract({ emitted: [{ type: 'a' }], accepted: [] }).emitted).toEqual([
      { type: 'a' },
      { type: ControlType.Beat },
      { type: ControlType.Size },
      { type: ControlType.Request },
      { type: ControlType.Response },
    ])
  })

  it('adds the control types to the accepted actions', () => {
    expect(withControlContract({ emitted: [], accepted: [{ type: 'b' }] }).accepted).toEqual([
      { type: 'b' },
      { type: ControlType.Beat },
      { type: ControlType.Size },
      { type: ControlType.Request },
      { type: ControlType.Response },
    ])
  })
})
