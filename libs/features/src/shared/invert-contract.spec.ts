import type { FeatureContract } from './types'
import { withControlContract } from './control'
import { invertFeatureContract } from './invert-contract'

const contract: FeatureContract = {
  emitted: [{ type: 'timeUpdated', description: 'Fires every second', schema: { type: 'object' } }],
  accepted: [{ type: 'setTimezone' }],
}

describe('invertFeatureContract', () => {
  it('emits what the feature accepts', () => {
    expect(invertFeatureContract(contract).emitted).toEqual([{ type: 'setTimezone' }])
  })

  it('accepts what the feature emits', () => {
    expect(invertFeatureContract(contract).accepted).toEqual([
      { type: 'timeUpdated', description: 'Fires every second', schema: { type: 'object' } },
    ])
  })

  it('builds fresh action objects that share no references with the source', () => {
    expect(invertFeatureContract(contract).accepted[0]).not.toBe(contract.emitted[0])
  })

  it('deep-copies nested schemas so no sub-object is shared with the source', () => {
    expect(invertFeatureContract(contract).accepted[0].schema).not.toBe(contract.emitted[0].schema)
  })

  it('keeps control types in both directions when composed with the control contract', () => {
    const composed = withControlContract(invertFeatureContract(contract))
    expect({
      emitted: composed.emitted.map((action) => action.type),
      accepted: composed.accepted.map((action) => action.type),
    }).toEqual({
      emitted: expect.arrayContaining(['setTimezone', '__hf:beat', '__hf:size']),
      accepted: expect.arrayContaining(['timeUpdated', '__hf:beat', '__hf:size']),
    })
  })
})
