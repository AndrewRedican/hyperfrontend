import type { SecurityProvider } from '../../types/security'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createProtocolRegistry } from './factory'

const createProvider = (): SecurityProvider => ({ createChannel: jest.fn(), protocolProvider: jest.fn() })

describe('Protocol Registry', () => {
  describe('register', () => {
    it('registers a v3 protocol provider', () => {
      const registry = createProtocolRegistry()
      const provider = createProvider()

      registry.register('v3', provider)

      expect(registry.get('v3')).toBe(provider)
    })

    it('registers a v4 protocol provider', () => {
      const registry = createProtocolRegistry()
      const provider = createProvider()

      registry.register('v4', provider)

      expect(registry.get('v4')).toBe(provider)
    })

    it('overwrites the provider registered for the same version', () => {
      const registry = createProtocolRegistry()
      const replacement = createProvider()

      registry.register('v3', createProvider())
      registry.register('v3', replacement)

      expect(registry.get('v3')).toBe(replacement)
    })

    it('throws when registering a null provider', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.register('v3', null as unknown as SecurityProvider)).toThrow('Cannot register null/undefined provider for v3')
    })

    it('throws when registering an undefined provider', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.register('v4', undefined as unknown as SecurityProvider)).toThrow(
        'Cannot register null/undefined provider for v4'
      )
    })

    it('registers an external protocol identifier', () => {
      const registry = createProtocolRegistry()
      const provider = createProvider()

      registry.register('acme-x25519', provider)

      expect(registry.get('acme-x25519')).toBe(provider)
    })

    it('throws when registering a provider for none', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.register('none', createProvider())).toThrow("Cannot register a provider for 'none'")
    })
  })

  describe('unregister', () => {
    it('removes a registered v3 provider', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())
      registry.unregister('v3')

      expect(registry.has('v3')).toBe(false)
    })

    it('removes a registered v4 provider', () => {
      const registry = createProtocolRegistry()

      registry.register('v4', createProvider())
      registry.unregister('v4')

      expect(registry.get('v4')).toBeUndefined()
    })

    it('tolerates unregistering an unknown version', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.unregister('v3')).not.toThrow()
    })

    it('leaves the other versions registered', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())
      registry.register('v4', createProvider())
      registry.unregister('v3')

      expect([registry.has('v3'), registry.has('v4')]).toEqual([false, true])
    })

    it('throws when unregistering none', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.unregister('none')).toThrow("Cannot unregister 'none'")
    })
  })

  describe('get', () => {
    it('returns the registered provider', () => {
      const registry = createProtocolRegistry()
      const provider = createProvider()

      registry.register('v4', provider)

      expect(registry.get('v4')).toBe(provider)
    })

    it('returns undefined for an unregistered version', () => {
      const registry = createProtocolRegistry()

      expect(registry.get('v3')).toBeUndefined()
    })

    it('returns undefined for none', () => {
      const registry = createProtocolRegistry()

      expect(registry.get('none')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('returns true for a registered provider', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())

      expect(registry.has('v3')).toBe(true)
    })

    it('returns false for an unregistered version', () => {
      const registry = createProtocolRegistry()

      expect(registry.has('v4')).toBe(false)
    })

    it('always returns true for none', () => {
      const registry = createProtocolRegistry()

      expect(registry.has('none')).toBe(true)
    })

    it('still returns true for none after registering other protocols', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())
      registry.register('v4', createProvider())

      expect(registry.has('none')).toBe(true)
    })
  })

  describe('getSupportedVersions', () => {
    it('lists only none when nothing is registered', () => {
      const registry = createProtocolRegistry()

      expect(registry.getSupportedVersions()).toEqual(['none'])
    })

    it('lists v3 ahead of none', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())

      expect(registry.getSupportedVersions()).toEqual(['v3', 'none'])
    })

    it('lists v4 ahead of none', () => {
      const registry = createProtocolRegistry()

      registry.register('v4', createProvider())

      expect(registry.getSupportedVersions()).toEqual(['v4', 'none'])
    })

    it('lists v4 ahead of v3 whatever the registration order', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())
      registry.register('v4', createProvider())

      expect(registry.getSupportedVersions()).toEqual(['v4', 'v3', 'none'])
    })

    it('lists external identifiers after the built-in versions in registration order', () => {
      const registry = createProtocolRegistry()

      registry.register('acme-b', createProvider())
      registry.register('v3', createProvider())
      registry.register('acme-a', createProvider())
      registry.register('v4', createProvider())

      expect(registry.getSupportedVersions()).toEqual(['v4', 'v3', 'acme-b', 'acme-a', 'none'])
    })

    it('drops a version once its provider is unregistered', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())
      registry.register('v4', createProvider())
      registry.unregister('v4')

      expect(registry.getSupportedVersions()).toEqual(['v3', 'none'])
    })

    it('returns a fresh array on each call', () => {
      const registry = createProtocolRegistry()

      registry.register('v3', createProvider())

      expect(registry.getSupportedVersions()).not.toBe(registry.getSupportedVersions())
    })
  })

  describe('isolation', () => {
    it('keeps each registry instance independent', () => {
      const first = createProtocolRegistry()
      const second = createProtocolRegistry()

      first.register('v3', createProvider())

      expect(second.has('v3')).toBe(false)
    })
  })
})
