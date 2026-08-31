import { validateContract, validateDisplayConfig, validateFeatureConfig, validatePayload } from './contract'

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

describe('validateDisplayConfig', () => {
  it('returns a fully-configured display declaration typed', () => {
    const display = {
      modes: ['embedded', 'dialog', 'popup'],
      embedded: { width: 320, height: 240 },
      dialog: { width: 480, height: 360, backdrop: 'event' },
      popup: { width: 500, height: 400 },
      closeOnEscape: false,
    }
    expect(validateDisplayConfig(display)).toBe(display)
  })

  it('accepts an empty display object', () => {
    expect(validateDisplayConfig({})).toEqual({})
  })

  it('rejects a null display', () => {
    expect(() => validateDisplayConfig(null)).toThrow('Invalid config: "display" must be an object, but got null.')
  })

  it('rejects an array display', () => {
    expect(() => validateDisplayConfig([])).toThrow('Invalid config: "display" must be an object, but got an array.')
  })

  it('rejects a primitive display', () => {
    expect(() => validateDisplayConfig('dialog')).toThrow('Invalid config: "display" must be an object, but got a string.')
  })

  it('rejects a non-array modes value', () => {
    expect(() => validateDisplayConfig({ modes: 'embedded' })).toThrow(
      '"display.modes" must be a non-empty array of display modes (embedded, dialog, popup, standalone).'
    )
  })

  it('rejects an empty modes array', () => {
    expect(() => validateDisplayConfig({ modes: [] })).toThrow(
      '"display.modes" must be a non-empty array of display modes (embedded, dialog, popup, standalone).'
    )
  })

  it('rejects an unknown mode by name', () => {
    expect(() => validateDisplayConfig({ modes: ['embedded', 'modal'] })).toThrow(
      '"display.modes" contains unknown modes: "modal" (expected embedded, dialog, popup, standalone).'
    )
  })

  it('lists every unknown mode at once', () => {
    expect(() => validateDisplayConfig({ modes: ['modal', 'inline'] })).toThrow('unknown modes: "modal", "inline"')
  })

  it('rejects a repeated mode', () => {
    expect(() => validateDisplayConfig({ modes: ['dialog', 'popup', 'dialog'] })).toThrow('"display.modes" must not repeat a mode.')
  })

  it('rejects a configured section whose mode is not declared', () => {
    expect(() => validateDisplayConfig({ modes: ['embedded'], embedded: { width: 320, height: 240 }, popup: { width: 500 } })).toThrow(
      '"display.popup" is configured, but "popup" is not in "display.modes" — declare the mode or drop its configuration.'
    )
  })

  it('accepts configured sections when no modes list is declared', () => {
    const display = { dialog: { width: 480 }, popup: {} }
    expect(validateDisplayConfig(display)).toBe(display)
  })

  it('rejects a non-object per-mode section', () => {
    expect(() => validateDisplayConfig({ embedded: 5 })).toThrow('"display.embedded" must be an object, but got a number.')
  })

  it('rejects an array per-mode section', () => {
    expect(() => validateDisplayConfig({ dialog: [] })).toThrow('"display.dialog" must be an object, but got an array.')
  })

  it('rejects a partial fixed embedded pair', () => {
    expect(() => validateDisplayConfig({ embedded: { width: 320 } })).toThrow(
      '"display.embedded" must declare both "width" and "height" — fixed dimensions are exact, so a partial pair is meaningless.'
    )
  })

  it('rejects a zero embedded dimension', () => {
    expect(() => validateDisplayConfig({ embedded: { width: 0, height: 240 } })).toThrow(
      '"display.embedded.width" must be a positive number of pixels.'
    )
  })

  it('rejects a negative dialog dimension', () => {
    expect(() => validateDisplayConfig({ dialog: { width: -1 } })).toThrow('"display.dialog.width" must be a positive number of pixels.')
  })

  it('rejects a non-number dimension', () => {
    expect(() => validateDisplayConfig({ dialog: { width: '480' } })).toThrow('"display.dialog.width" must be a positive number of pixels.')
  })

  it('rejects a NaN dimension', () => {
    expect(() => validateDisplayConfig({ popup: { width: NaN } })).toThrow('"display.popup.width" must be a positive number of pixels.')
  })

  it('rejects an Infinity dimension', () => {
    expect(() => validateDisplayConfig({ popup: { height: Infinity } })).toThrow(
      '"display.popup.height" must be a positive number of pixels.'
    )
  })

  it.each([
    'center',
    'top-left',
    'top-center',
    'top-right',
    'center-left',
    'center-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ] as const)('accepts the %s dialog position', (position) => {
    expect(validateDisplayConfig({ dialog: { position } })).toEqual({ dialog: { position } })
  })

  it('accepts a popup position', () => {
    expect(validateDisplayConfig({ popup: { position: 'bottom-right' } })).toEqual({ popup: { position: 'bottom-right' } })
  })

  it('rejects an unknown dialog position quoting the string', () => {
    expect(() => validateDisplayConfig({ dialog: { position: 'middle' } })).toThrow(
      '"display.dialog.position" must be one of center, top-left, top-center, top-right, center-left, center-right, bottom-left, bottom-center, bottom-right, but got "middle".'
    )
  })

  it('rejects an unknown popup position quoting the string', () => {
    expect(() => validateDisplayConfig({ popup: { position: 'top' } })).toThrow(
      '"display.popup.position" must be one of center, top-left, top-center, top-right, center-left, center-right, bottom-left, bottom-center, bottom-right, but got "top".'
    )
  })

  it('rejects a non-string dialog position by kind', () => {
    expect(() => validateDisplayConfig({ dialog: { position: 7 } })).toThrow(
      '"display.dialog.position" must be one of center, top-left, top-center, top-right, center-left, center-right, bottom-left, bottom-center, bottom-right, but got a number.'
    )
  })

  it('rejects a null popup position by kind', () => {
    expect(() => validateDisplayConfig({ popup: { position: null } })).toThrow(
      '"display.popup.position" must be one of center, top-left, top-center, top-right, center-left, center-right, bottom-left, bottom-center, bottom-right, but got null.'
    )
  })

  it('leaves an embedded position outside position validation', () => {
    const display = { embedded: { width: 320, height: 240, position: 'middle' } }
    expect(validateDisplayConfig(display)).toBe(display)
  })

  it.each(['close', 'event', 'none'] as const)('accepts the %s backdrop behavior', (backdrop) => {
    expect(validateDisplayConfig({ dialog: { backdrop } })).toEqual({ dialog: { backdrop } })
  })

  it('rejects an unknown backdrop behavior by name', () => {
    expect(() => validateDisplayConfig({ dialog: { backdrop: 'modal' } })).toThrow(
      '"display.dialog.backdrop" must be "close", "event", or "none", but got "modal".'
    )
  })

  it('rejects a non-string backdrop by kind', () => {
    expect(() => validateDisplayConfig({ dialog: { backdrop: true } })).toThrow(
      '"display.dialog.backdrop" must be "close", "event", or "none", but got a boolean.'
    )
  })

  it('rejects a non-boolean closeOnEscape', () => {
    expect(() => validateDisplayConfig({ closeOnEscape: 'yes' })).toThrow('"display.closeOnEscape" must be a boolean, but got a string.')
  })

  it('reports every display problem in a single error', () => {
    expect(() => validateDisplayConfig({ modes: [], embedded: { width: -1 } })).toThrow(
      /"display\.modes"[\s\S]*"display\.embedded" must declare both[\s\S]*"display\.embedded\.width"/
    )
  })

  it('reports the incomplete fixed pair once when both axes are missing', () => {
    expect(() => validateDisplayConfig({ embedded: {} })).toThrow(
      'Invalid config:\n  - "display.embedded" must declare both "width" and "height" — fixed dimensions are exact, so a partial pair is meaningless.'
    )
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
