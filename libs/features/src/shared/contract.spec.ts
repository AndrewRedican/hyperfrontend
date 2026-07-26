import { validateContract, validateFeatureConfig, validatePayload } from './contract'

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

  it('distinguishes a non-object action from a missing type', () => {
    expect(() => validateContract({ emitted: ['setTimezone'], accepted: [] })).toThrow('"emitted[0]" must be an object, but got a string')
  })

  it('reports every malformed action in a single error', () => {
    expect(() => validateContract({ emitted: [{ description: 'no type' }], accepted: [null] })).toThrow(
      /"emitted\[0\]".*\n.*"accepted\[0\]"/
    )
  })

  it('accepts an emitted request answered by an accepted action', () => {
    expect(validateContract({ emitted: [{ type: 'getTime', respondsWith: 'time' }], accepted: [{ type: 'time' }] })).toEqual({
      emitted: [{ type: 'getTime', respondsWith: 'time' }],
      accepted: [{ type: 'time' }],
    })
  })

  it('accepts an accepted request answered by an emitted action', () => {
    expect(validateContract({ emitted: [{ type: 'settings' }], accepted: [{ type: 'getSettings', respondsWith: 'settings' }] })).toEqual({
      emitted: [{ type: 'settings' }],
      accepted: [{ type: 'getSettings', respondsWith: 'settings' }],
    })
  })

  it('rejects an emitted respondsWith that names no accepted action', () => {
    expect(() => validateContract({ emitted: [{ type: 'getTime', respondsWith: 'time' }], accepted: [] })).toThrow(
      '"emitted[0]" responds with "time", but "accepted" has no action of that type.'
    )
  })

  it('rejects an accepted respondsWith that names no emitted action', () => {
    expect(() => validateContract({ emitted: [], accepted: [{ type: 'getSettings', respondsWith: 'settings' }] })).toThrow(
      '"accepted[0]" responds with "settings", but "emitted" has no action of that type.'
    )
  })

  it('rejects a non-string respondsWith', () => {
    expect(() => validateContract({ emitted: [{ type: 'getTime', respondsWith: 42 }], accepted: [] })).toThrow(
      '"emitted[0]" has a "respondsWith" that must be a non-empty string.'
    )
  })

  it('rejects an empty respondsWith', () => {
    expect(() => validateContract({ emitted: [], accepted: [{ type: 'getTime', respondsWith: '' }] })).toThrow(
      '"accepted[0]" has a "respondsWith" that must be a non-empty string.'
    )
  })

  it('accepts a boolean required flag', () => {
    expect(validateContract({ emitted: [{ type: 'tick' }], accepted: [{ type: 'setTimezone', required: true }] })).toEqual({
      emitted: [{ type: 'tick' }],
      accepted: [{ type: 'setTimezone', required: true }],
    })
  })

  it('rejects a non-boolean required flag', () => {
    expect(() => validateContract({ emitted: [], accepted: [{ type: 'setTimezone', required: 'yes' }] })).toThrow(
      '"accepted[0]" has a "required" that must be a boolean.'
    )
  })

  it('retains a valid semver version', () => {
    expect(validateContract({ emitted: [{ type: 'tick' }], accepted: [], version: '1.2.0' })).toEqual({
      emitted: [{ type: 'tick' }],
      accepted: [],
      version: '1.2.0',
    })
  })

  it('omits the version key when the contract declares none', () => {
    expect(validateContract({ emitted: [{ type: 'tick' }], accepted: [] })).not.toHaveProperty('version')
  })

  it('narrows unknown keys away while retaining the version', () => {
    expect(validateContract({ emitted: [], accepted: [{ type: 'tick' }], version: '2.0.0', extra: 'dropped' })).toEqual({
      emitted: [],
      accepted: [{ type: 'tick' }],
      version: '2.0.0',
    })
  })

  it('rejects a non-string version', () => {
    expect(() => validateContract({ emitted: [{ type: 'tick' }], accepted: [], version: 2 })).toThrow(
      '"version" must be a semver string, but got a number.'
    )
  })

  it('rejects a version that is not valid semver', () => {
    expect(() => validateContract({ emitted: [{ type: 'tick' }], accepted: [], version: 'latest' })).toThrow(
      '"version" must be a valid semver version (e.g. "1.2.0"), but got "latest".'
    )
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

describe('validatePayload', () => {
  const schema = { type: 'object', properties: { tz: { type: 'string' } }, required: ['tz'] }

  it('passes a type-only action with no schema', () => {
    expect(validatePayload({ type: 'setTimezone' }, { anything: true })).toEqual({ valid: true, errors: [] })
  })

  it('passes a payload that satisfies the action schema', () => {
    expect(validatePayload({ type: 'setTimezone', schema }, { tz: 'UTC' })).toEqual(expect.objectContaining({ valid: true }))
  })

  it('fails a payload that violates the action schema', () => {
    expect(validatePayload({ type: 'setTimezone', schema }, {})).toEqual(expect.objectContaining({ valid: false }))
  })
})
