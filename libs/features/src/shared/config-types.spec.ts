import type { ResolvedFeatureConfig } from './types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolveDeclaredModes } from '../generators/shared/declared-modes'
import { ISOLATED_FRAMED, ISOLATED_SAME_ORIGIN, OPEN_ORIGIN } from './config-types.assert'
import { validateDisplayConfig, validateIsolationConfig } from './contract'

// note: The compile-time half of this guarantee lives in config-types.assert.ts, where `nx typecheck` reaches it; these cover the runtime half that a JSON-authored config takes.

const IDENTITY = { name: 'probe', version: '1.0.0', contract: './probe.contract.json', url: '/' }

describe('validateIsolationConfig', () => {
  it('accepts a bare coep value as cross-origin reach', () => {
    expect(validateIsolationConfig('require-corp')).toBe('require-corp')
  })

  it('accepts the same-origin object form', () => {
    expect(validateIsolationConfig({ coep: 'credentialless', hosts: 'same-origin' })).toEqual({
      coep: 'credentialless',
      hosts: 'same-origin',
    })
  })

  it('rejects an unknown coep value', () => {
    expect(() => validateIsolationConfig('require-cors')).toThrow(/must be one of require-corp, credentialless/)
  })

  it('rejects an unknown coep value inside the object form', () => {
    expect(() => validateIsolationConfig({ coep: 'require-cors', hosts: 'same-origin' })).toThrow(/"isolation.coep" must be one of/)
  })

  it('rejects a non-string coep inside the object form', () => {
    expect(() => validateIsolationConfig({ coep: true, hosts: 'same-origin' })).toThrow(/"isolation.coep" must be one of/)
  })

  it('rejects a reach other than same-origin', () => {
    expect(() => validateIsolationConfig({ coep: 'require-corp', hosts: 'any' })).toThrow(/must be "same-origin"/)
  })

  it('rejects a value that is neither a string nor an object', () => {
    expect(() => validateIsolationConfig(7)).toThrow(/must be a string or an object/)
  })
})

describe('validateDisplayConfig against a declared isolation', () => {
  it('refuses a windowed mode on a cross-origin isolated origin', () => {
    expect(() => validateDisplayConfig({ modes: ['embedded', 'popup'] }, 'require-corp')).toThrow(/cannot serve to a cross-origin host/)
  })

  it('names every unreachable mode at once', () => {
    expect(() => validateDisplayConfig({ modes: ['popup', 'standalone'] }, 'credentialless')).toThrow(/"popup" and "standalone"/)
  })

  it('permits the windowed modes when the feature declared same-origin reach', () => {
    expect(validateDisplayConfig({ modes: ['embedded', 'popup'] }, { coep: 'require-corp', hosts: 'same-origin' })).toEqual({
      modes: ['embedded', 'popup'],
    })
  })

  it('permits the framed modes on a cross-origin isolated origin', () => {
    expect(validateDisplayConfig({ modes: ['embedded', 'dialog'] }, 'require-corp')).toEqual({ modes: ['embedded', 'dialog'] })
  })

  it('leaves an undeclared isolation unconstrained', () => {
    expect(validateDisplayConfig({ modes: ['popup', 'standalone'] })).toEqual({ modes: ['popup', 'standalone'] })
  })
})

describe('resolveDeclaredModes', () => {
  it('composes every mode for a feature that declares neither modes nor isolation', () => {
    expect(resolveDeclaredModes(IDENTITY as ResolvedFeatureConfig)).toEqual(['embedded', 'dialog', 'popup', 'standalone'])
  })

  it('drops the windowed modes from the default set on a cross-origin isolated origin', () => {
    expect(resolveDeclaredModes({ ...IDENTITY, isolation: 'require-corp' } as ResolvedFeatureConfig)).toEqual(['embedded', 'dialog'])
  })

  it('keeps the default set whole when the feature declared same-origin reach', () => {
    expect(
      resolveDeclaredModes({ ...IDENTITY, isolation: { coep: 'require-corp', hosts: 'same-origin' } } as ResolvedFeatureConfig)
    ).toEqual(['embedded', 'dialog', 'popup', 'standalone'])
  })

  it('honours an explicit modes list over the isolation-derived default', () => {
    expect(resolveDeclaredModes({ ...IDENTITY, ...ISOLATED_FRAMED, url: '/' } as ResolvedFeatureConfig)).toEqual(['embedded', 'dialog'])
  })
})

describe('the typechecked config probes', () => {
  it('declares every mode on an open origin', () => {
    expect(OPEN_ORIGIN.display?.modes).toEqual(['embedded', 'dialog', 'popup', 'standalone'])
  })

  it('keeps the windowed modes under a same-origin isolation declaration', () => {
    expect(ISOLATED_SAME_ORIGIN.display?.modes).toEqual(['embedded', 'popup', 'standalone'])
  })
})
