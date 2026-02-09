/**
 * Unit Tests: Protocol Registry
 *
 * Tests the registry for managing protocol providers at the broker level.
 */

import { createProtocolRegistry } from '../factory'

describe('Protocol Registry', () => {
  describe('register', () => {
    it('registers a v1 protocol provider', () => {
      const registry = createProtocolRegistry()
      const mockProvider = { id: 'v1-provider' }

      registry.register('v1', mockProvider)

      expect(registry.has('v1')).toBe(true)
      expect(registry.get('v1')).toBe(mockProvider)
    })

    it('registers a v2 protocol provider', () => {
      const registry = createProtocolRegistry()
      const mockProvider = { id: 'v2-provider' }

      registry.register('v2', mockProvider)

      expect(registry.has('v2')).toBe(true)
      expect(registry.get('v2')).toBe(mockProvider)
    })

    it('overwrites existing provider for same version', () => {
      const registry = createProtocolRegistry()
      const provider1 = { id: 'first' }
      const provider2 = { id: 'second' }

      registry.register('v1', provider1)
      registry.register('v1', provider2)

      expect(registry.get('v1')).toBe(provider2)
    })

    it('throws error when registering null provider', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.register('v1', null)).toThrow('Cannot register null/undefined provider for v1')
    })

    it('throws error when registering undefined provider', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.register('v2', undefined)).toThrow('Cannot register null/undefined provider for v2')
    })

    it('allows registering both v1 and v2 providers', () => {
      const registry = createProtocolRegistry()
      const v1Provider = { id: 'v1' }
      const v2Provider = { id: 'v2' }

      registry.register('v1', v1Provider)
      registry.register('v2', v2Provider)

      expect(registry.get('v1')).toBe(v1Provider)
      expect(registry.get('v2')).toBe(v2Provider)
    })
  })

  describe('unregister', () => {
    it('removes registered v1 provider', () => {
      const registry = createProtocolRegistry()
      const mockProvider = { id: 'v1-provider' }

      registry.register('v1', mockProvider)
      registry.unregister('v1')

      expect(registry.has('v1')).toBe(false)
      expect(registry.get('v1')).toBeUndefined()
    })

    it('removes registered v2 provider', () => {
      const registry = createProtocolRegistry()
      const mockProvider = { id: 'v2-provider' }

      registry.register('v2', mockProvider)
      registry.unregister('v2')

      expect(registry.has('v2')).toBe(false)
      expect(registry.get('v2')).toBeUndefined()
    })

    it('does not throw when unregistering non-existent provider', () => {
      const registry = createProtocolRegistry()

      expect(() => registry.unregister('v1')).not.toThrow()
      expect(() => registry.unregister('v2')).not.toThrow()
    })

    it('only removes specified version', () => {
      const registry = createProtocolRegistry()
      const v1Provider = { id: 'v1' }
      const v2Provider = { id: 'v2' }

      registry.register('v1', v1Provider)
      registry.register('v2', v2Provider)
      registry.unregister('v1')

      expect(registry.has('v1')).toBe(false)
      expect(registry.has('v2')).toBe(true)
    })
  })

  describe('get', () => {
    it('returns registered provider', () => {
      const registry = createProtocolRegistry()
      const mockProvider = { id: 'test-provider' }

      registry.register('v1', mockProvider)

      expect(registry.get('v1')).toBe(mockProvider)
    })

    it('returns undefined for unregistered version', () => {
      const registry = createProtocolRegistry()

      expect(registry.get('v1')).toBeUndefined()
      expect(registry.get('v2')).toBeUndefined()
    })

    it('returns undefined for "none" protocol', () => {
      const registry = createProtocolRegistry()

      expect(registry.get('none')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('returns true for registered provider', () => {
      const registry = createProtocolRegistry()
      registry.register('v1', { id: 'test' })

      expect(registry.has('v1')).toBe(true)
    })

    it('returns false for unregistered version', () => {
      const registry = createProtocolRegistry()

      expect(registry.has('v1')).toBe(false)
      expect(registry.has('v2')).toBe(false)
    })

    it('always returns true for "none" protocol', () => {
      const registry = createProtocolRegistry()

      expect(registry.has('none')).toBe(true)
    })

    it('still returns true for "none" after registering other protocols', () => {
      const registry = createProtocolRegistry()
      registry.register('v1', { id: 'v1' })
      registry.register('v2', { id: 'v2' })

      expect(registry.has('none')).toBe(true)
    })
  })

  describe('getSupportedVersions', () => {
    it('returns only "none" when no providers registered', () => {
      const registry = createProtocolRegistry()

      const versions = registry.getSupportedVersions()

      expect(versions).toEqual(['none'])
    })

    it('includes v1 when v1 provider is registered', () => {
      const registry = createProtocolRegistry()
      registry.register('v1', { id: 'v1' })

      const versions = registry.getSupportedVersions()

      expect(versions).toContain('v1')
      expect(versions).toContain('none')
    })

    it('includes v2 when v2 provider is registered', () => {
      const registry = createProtocolRegistry()
      registry.register('v2', { id: 'v2' })

      const versions = registry.getSupportedVersions()

      expect(versions).toContain('v2')
      expect(versions).toContain('none')
    })

    it('includes both v1 and v2 when both are registered', () => {
      const registry = createProtocolRegistry()
      registry.register('v1', { id: 'v1' })
      registry.register('v2', { id: 'v2' })

      const versions = registry.getSupportedVersions()

      expect(versions).toContain('v1')
      expect(versions).toContain('v2')
      expect(versions).toContain('none')
    })

    it('puts higher versions first in the list', () => {
      const registry = createProtocolRegistry()
      registry.register('v1', { id: 'v1' })
      registry.register('v2', { id: 'v2' })

      const versions = registry.getSupportedVersions()

      expect(versions.indexOf('v2')).toBeLessThan(versions.indexOf('v1'))
      expect(versions.indexOf('v1')).toBeLessThan(versions.indexOf('none'))
    })

    it('updates after provider is unregistered', () => {
      const registry = createProtocolRegistry()
      registry.register('v1', { id: 'v1' })
      registry.register('v2', { id: 'v2' })

      registry.unregister('v2')
      const versions = registry.getSupportedVersions()

      expect(versions).not.toContain('v2')
      expect(versions).toContain('v1')
      expect(versions).toContain('none')
    })

    it('returns fresh array on each call', () => {
      const registry = createProtocolRegistry()
      registry.register('v1', { id: 'v1' })

      const versions1 = registry.getSupportedVersions()
      const versions2 = registry.getSupportedVersions()

      expect(versions1).not.toBe(versions2)
      expect(versions1).toEqual(versions2)
    })
  })

  describe('isolation', () => {
    it('each registry instance is independent', () => {
      const registry1 = createProtocolRegistry()
      const registry2 = createProtocolRegistry()

      registry1.register('v1', { id: 'r1-v1' })

      expect(registry1.has('v1')).toBe(true)
      expect(registry2.has('v1')).toBe(false)
    })
  })
})
