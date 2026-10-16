import { describe, expect, it } from '@hyperfrontend/testing'
import { validateAction } from './action'
import { validateContract } from './contract'
import { validateName } from './name'
import { validateOrigin } from './origin'
import { validateSettings } from './settings'

describe('Validation Functions', () => {
  describe('validateName', () => {
    it.each(['channel-1', 'my-channel', 'a', 'Channel_Name_123'])('accepts the name %s', (name: string) => {
      expect(() => validateName(name)).not.toThrow()
    })

    it('rejects null name', () => {
      expect(() => validateName(null as unknown as string)).toThrow('Name cannot be null or undefined')
    })

    it('rejects undefined name', () => {
      expect(() => validateName(undefined as unknown as string)).toThrow('Name cannot be null or undefined')
    })

    it.each([
      ['a number', 123],
      ['an object', {}],
      ['an array', []],
    ])('rejects a name that is %s as not a string', (_label: string, name: unknown) => {
      expect(() => validateName(name as string)).toThrow('Name must be a string')
    })

    it.each([
      ['an empty string', ''],
      ['whitespace only', '   '],
    ])('rejects a name that is %s as empty', (_label: string, name: string) => {
      expect(() => validateName(name)).toThrow('Name cannot be empty')
    })
  })

  describe('validateContract', () => {
    it('acceptss valid contracts with emitted actions', () => {
      const contract = {
        emitted: [{ type: 'action1' }, { type: 'action2' }],
        accepted: [],
      }
      expect(() => validateContract(contract)).not.toThrow()
    })

    it('acceptss valid contracts with accepted actions', () => {
      const contract = {
        emitted: [],
        accepted: [{ type: 'action1' }, { type: 'action2' }],
      }
      expect(() => validateContract(contract)).not.toThrow()
    })

    it('acceptss valid contracts with both', () => {
      const contract = {
        emitted: [{ type: 'action1' }],
        accepted: [{ type: 'action2' }],
      }
      expect(() => validateContract(contract)).not.toThrow()
    })

    it('rejects null contract', () => {
      expect(() => validateContract(null)).toThrow('Contract cannot be null or undefined')
    })

    it('rejects undefined contract', () => {
      expect(() => validateContract(undefined)).toThrow('Contract cannot be null or undefined')
    })

    it.each([
      ['a string', 'contract'],
      ['a number', 123],
      ['an array', []],
    ])('rejects a contract that is %s', (_label: string, contract: unknown) => {
      expect(() => validateContract(contract)).toThrow('Contract must be an object')
    })

    it('rejects empty contracts', () => {
      expect(() => validateContract({})).toThrow('Contract must contain at least one accepted or emitted action')
    })

    it('rejects contracts with empty arrays', () => {
      const contract = {
        emitted: [],
        accepted: [],
      }
      expect(() => validateContract(contract)).toThrow('Contract must contain at least one accepted or emitted action')
    })

    it('accepts a string version announcement', () => {
      const contract = {
        emitted: [{ type: 'action1' }],
        accepted: [],
        version: '1.2.3',
      }
      expect(() => validateContract(contract)).not.toThrow()
    })

    it('rejects a non-string version announcement', () => {
      const contract = {
        emitted: [{ type: 'action1' }],
        accepted: [],
        version: 2,
      }
      expect(() => validateContract(contract)).toThrow('Contract version must be a string')
    })

    it('handles contracts with missing emitted', () => {
      const contract = {
        accepted: [{ type: 'action1' }],
      }
      expect(() => validateContract(contract)).not.toThrow()
    })

    it('handles contracts with missing accepted', () => {
      const contract = {
        emitted: [{ type: 'action1' }],
      }
      expect(() => validateContract(contract)).not.toThrow()
    })

    it('rejects contracts with empty string action types in emitted', () => {
      const contract = {
        emitted: [{ type: '' }],
        accepted: [],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with whitespace-only action types in emitted', () => {
      const contract = {
        emitted: [{ type: '   ' }],
        accepted: [],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with empty string action types in accepted', () => {
      const contract = {
        emitted: [],
        accepted: [{ type: '' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with whitespace-only action types in accepted', () => {
      const contract = {
        emitted: [],
        accepted: [{ type: '   ' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with null action in emitted', () => {
      const contract = {
        emitted: [null as unknown as { type: string }],
        accepted: [{ type: 'valid' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with null action in accepted', () => {
      const contract = {
        emitted: [{ type: 'valid' }],
        accepted: [null as unknown as { type: string }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with action missing type property in emitted', () => {
      const contract = {
        emitted: [{ description: 'no type' } as unknown as { type: string }],
        accepted: [{ type: 'valid' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with action missing type property in accepted', () => {
      const contract = {
        emitted: [{ type: 'valid' }],
        accepted: [{ description: 'no type' } as unknown as { type: string }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with non-string type in emitted', () => {
      const contract = {
        emitted: [{ type: 123 } as unknown as { type: string }],
        accepted: [{ type: 'valid' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with non-string type in accepted', () => {
      const contract = {
        emitted: [{ type: 'valid' }],
        accepted: [{ type: 123 } as unknown as { type: string }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })
  })

  describe('validateAction', () => {
    const validAction = {
      type: 'TEST_ACTION',
      senderId: '12345678-1234-4123-8123-123456789012',
      timestamp: Date.now(),
    }

    it('acceptss valid actions', () => {
      expect(() => validateAction(validAction)).not.toThrow()
    })

    it('acceptss actions with processId', () => {
      const action = {
        ...validAction,
        processId: '87654321-4321-4321-8321-210987654321',
      }
      expect(() => validateAction(action)).not.toThrow()
    })

    it('rejects null action', () => {
      expect(() => validateAction(null)).toThrow('Action cannot be null or undefined')
    })

    it('rejects undefined action', () => {
      expect(() => validateAction(undefined)).toThrow('Action cannot be null or undefined')
    })

    it.each([
      ['a string', 'action'],
      ['a number', 123],
    ])('rejects an action that is %s', (_label: string, action: unknown) => {
      expect(() => validateAction(action)).toThrow('Action must be an object')
    })

    it('rejects action without type', () => {
      const action = { ...validAction }
      delete (action as Record<string, unknown>)['type']
      expect(() => validateAction(action)).toThrow('Action must have a string type')
    })

    it('rejects action with non-string type', () => {
      const action = { ...validAction, type: 123 }
      expect(() => validateAction(action)).toThrow('Action must have a string type')
    })

    it('rejects action without senderId', () => {
      const action = { ...validAction }
      delete (action as Record<string, unknown>)['senderId']
      expect(() => validateAction(action)).toThrow('Action must have a valid UUID senderId')
    })

    it('rejects action with invalid senderId', () => {
      const action = { ...validAction, senderId: 'not-a-uuid' }
      expect(() => validateAction(action)).toThrow('Action must have a valid UUID senderId')
    })

    it('rejects action without timestamp', () => {
      const action = { ...validAction }
      delete (action as Record<string, unknown>)['timestamp']
      expect(() => validateAction(action)).toThrow('Action must have a valid positive timestamp')
    })

    it('rejects action with invalid timestamp', () => {
      const action = { ...validAction, timestamp: -1 }
      expect(() => validateAction(action)).toThrow('Action must have a valid positive timestamp')
    })

    it('rejects action with zero timestamp', () => {
      const action = { ...validAction, timestamp: 0 }
      expect(() => validateAction(action)).toThrow('Action must have a valid positive timestamp')
    })

    it('rejects action with invalid processId', () => {
      const action = { ...validAction, processId: 'not-a-uuid' }
      expect(() => validateAction(action)).toThrow('Action processId must be a valid UUID when present')
    })

    it('acceptss action with null processId', () => {
      const action = { ...validAction, processId: null }
      expect(() => validateAction(action)).not.toThrow()
    })

    it('acceptss action with undefined processId', () => {
      const action = { ...validAction, processId: undefined }
      expect(() => validateAction(action)).not.toThrow()
    })
  })

  describe('validateOrigin', () => {
    it.each(['http://example.com', 'http://localhost:3000'])('accepts the http origin %s', (origin: string) => {
      expect(() => validateOrigin(origin)).not.toThrow()
    })

    it.each(['https://example.com', 'https://api.example.com'])('accepts the https origin %s', (origin: string) => {
      expect(() => validateOrigin(origin)).not.toThrow()
    })

    it('acceptss wildcard origin', () => {
      expect(() => validateOrigin('*')).not.toThrow()
    })

    it('rejects null origin', () => {
      expect(() => validateOrigin(null as unknown as string)).toThrow('Origin cannot be null or undefined')
    })

    it('rejects undefined origin', () => {
      expect(() => validateOrigin(undefined as unknown as string)).toThrow('Origin cannot be null or undefined')
    })

    it.each([
      ['a number', 123],
      ['an object', {}],
    ])('rejects an origin that is %s as not a string', (_label: string, origin: unknown) => {
      expect(() => validateOrigin(origin as string)).toThrow('Origin must be a string')
    })

    it.each([
      ['an empty string', ''],
      ['whitespace only', '   '],
    ])('rejects an origin that is %s as empty', (_label: string, origin: string) => {
      expect(() => validateOrigin(origin)).toThrow('Origin cannot be empty')
    })

    it.each(['not-a-url', '://broken'])('rejects the invalid URL %s', (origin: string) => {
      expect(() => validateOrigin(origin)).toThrow('Invalid origin URL')
    })

    it.each(['ftp://example.com', 'file:///path/to/file'])('rejects the non-http protocol of %s', (origin: string) => {
      expect(() => validateOrigin(origin)).toThrow('Origin must use http or https protocol')
    })
  })

  describe('validateSettings', () => {
    it('acceptss null settings', () => {
      expect(() => validateSettings(null)).not.toThrow()
    })

    it('acceptss undefined settings', () => {
      expect(() => validateSettings(undefined)).not.toThrow()
    })

    it('acceptss empty settings object', () => {
      expect(() => validateSettings({})).not.toThrow()
    })

    it.each([true, false])('accepts settings with queueMessages set to %s', (queueMessages: boolean) => {
      expect(() => validateSettings({ queueMessages })).not.toThrow()
    })

    it.each(['debug', 'error'])('accepts settings with the log level %s', (logLevel: string) => {
      expect(() => validateSettings({ logLevel })).not.toThrow()
    })

    it.each(['http://example.com', '*'])('accepts settings with the origin %s', (origin: string) => {
      expect(() => validateSettings({ origin })).not.toThrow()
    })

    it('acceptss valid settings with contract', () => {
      const contract = { emitted: ['action1'], accepted: [] }
      expect(() => validateSettings({ contract })).not.toThrow()
    })

    it('acceptss all valid settings combined', () => {
      const settings = {
        queueMessages: true,

        origin: 'http://example.com',
        contract: { emitted: ['action1'], accepted: [] },
      }
      expect(() => validateSettings(settings)).not.toThrow()
    })

    it.each([
      ['a string', 'settings'],
      ['a number', 123],
      ['an array', []],
    ])('rejects settings that are %s', (_label: string, settings: unknown) => {
      expect(() => validateSettings(settings)).toThrow('Settings must be an object')
    })

    it.each([
      ['a string', 'true'],
      ['a number', 1],
    ])('rejects a queueMessages setting that is %s', (_label: string, queueMessages: unknown) => {
      expect(() => validateSettings({ queueMessages })).toThrow('Setting queueMessages must be a boolean')
    })

    it.each([
      ['a string', 'true'],
      ['a number', 1],
    ])('rejects a debug setting that is %s', (_label: string, debug: unknown) => {
      expect(() => validateSettings({ debug })).toThrow('Setting debug must be a boolean')
    })

    it.each([
      ['a number', 123],
      ['an object', {}],
    ])('rejects an origin setting that is %s', (_label: string, origin: unknown) => {
      expect(() => validateSettings({ origin })).toThrow('Setting origin must be a string')
    })

    it.each([
      ['a string', 'contract'],
      ['a number', 123],
    ])('rejects a contract setting that is %s', (_label: string, contract: unknown) => {
      expect(() => validateSettings({ contract })).toThrow('Setting contract must be an object')
    })

    it('acceptss null contract', () => {
      expect(() => validateSettings({ contract: null })).not.toThrow()
    })

    it('acceptss settings with unknown properties', () => {
      const settings = {
        queueMessages: true,
        unknownProperty: 'value',
      }
      expect(() => validateSettings(settings)).not.toThrow()
    })
  })
})
