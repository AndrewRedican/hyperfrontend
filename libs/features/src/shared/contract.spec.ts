import { validateContract, validateFeatureConfig } from './contract'

describe('validateContract', () => {
  it('returns a typed contract for a well-formed object', () => {
    expect(validateContract({ emitted: [{ type: 'setTimezone' }], accepted: [{ type: 'timeUpdated' }] })).toEqual({
      emitted: [{ type: 'setTimezone' }],
      accepted: [{ type: 'timeUpdated' }],
    })
  })

  it('rejects a non-object contract', () => {
    expect(() => validateContract(null)).toThrow('expected an object')
  })

  it('rejects an array contract', () => {
    expect(() => validateContract([])).toThrow('expected an object')
  })

  it('rejects a missing emitted array', () => {
    expect(() => validateContract({ accepted: [] })).toThrow('"emitted" must be an array')
  })

  it('rejects a missing accepted array', () => {
    expect(() => validateContract({ emitted: [] })).toThrow('"accepted" must be an array')
  })

  it('rejects an action without a string type', () => {
    expect(() => validateContract({ emitted: [{ description: 'no type' }], accepted: [] })).toThrow('emitted[0]')
  })

  it('rejects an action with an empty type', () => {
    expect(() => validateContract({ emitted: [], accepted: [{ type: '' }] })).toThrow('accepted[0]')
  })
})

describe('validateFeatureConfig', () => {
  it('returns a typed config for a well-formed object', () => {
    expect(validateFeatureConfig({ name: 'clock', version: '1.0.0', contract: './clock.contract.json' })).toEqual({
      name: 'clock',
      version: '1.0.0',
      contract: './clock.contract.json',
    })
  })

  it('rejects a non-object config', () => {
    expect(() => validateFeatureConfig('clock')).toThrow('expected an object')
  })

  it('rejects a config missing a required string field', () => {
    expect(() => validateFeatureConfig({ name: 'clock', version: '1.0.0' })).toThrow('"contract" must be a non-empty string')
  })
})
