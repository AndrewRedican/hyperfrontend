/**
 * Tests for validation functions
 */

import { validateName } from './name'
import { validateContract } from './contract'
import { validateAction } from './action'
import { validateOrigin } from './origin'
import { validateSettings } from './settings'

describe('Validation Functions', () => {
  describe('validateName', () => {
    it('acceptss valid names', () => {
      expect(() => validateName('channel-1')).not.toThrow()
      expect(() => validateName('my-channel')).not.toThrow()
      expect(() => validateName('a')).not.toThrow()
      expect(() => validateName('Channel_Name_123')).not.toThrow()
    })

    it('rejects null name', () => {
      expect(() => validateName(<string>(<unknown>null))).toThrow('Name cannot be null or undefined')
    })

    it('rejects undefined name', () => {
      expect(() => validateName(<string>(<unknown>undefined))).toThrow('Name cannot be null or undefined')
    })

    it('rejects non-string names', () => {
      expect(() => validateName(<string>(<unknown>123))).toThrow('Name must be a string')
      expect(() => validateName(<string>(<unknown>{}))).toThrow('Name must be a string')
      expect(() => validateName(<string>(<unknown>[]))).toThrow('Name must be a string')
    })

    it('rejects empty strings', () => {
      expect(() => validateName('')).toThrow('Name cannot be empty')
      expect(() => validateName('   ')).toThrow('Name cannot be empty')
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

    it('rejects non-object contracts', () => {
      expect(() => validateContract(<unknown>'contract')).toThrow('Contract must be an object')
      expect(() => validateContract(<unknown>123)).toThrow('Contract must be an object')
      expect(() => validateContract(<unknown>[])).toThrow('Contract must be an object')
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
        emitted: [<{ type: string }>(<unknown>null)],
        accepted: [{ type: 'valid' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with null action in accepted', () => {
      const contract = {
        emitted: [{ type: 'valid' }],
        accepted: [<{ type: string }>(<unknown>null)],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with action missing type property in emitted', () => {
      const contract = {
        emitted: [<{ type: string }>(<unknown>{ description: 'no type' })],
        accepted: [{ type: 'valid' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with action missing type property in accepted', () => {
      const contract = {
        emitted: [{ type: 'valid' }],
        accepted: [<{ type: string }>(<unknown>{ description: 'no type' })],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with non-string type in emitted', () => {
      const contract = {
        emitted: [<{ type: string }>(<unknown>{ type: 123 })],
        accepted: [{ type: 'valid' }],
      }
      expect(() => validateContract(contract)).toThrow('Contract action types must be non-empty strings')
    })

    it('rejects contracts with non-string type in accepted', () => {
      const contract = {
        emitted: [{ type: 'valid' }],
        accepted: [<{ type: string }>(<unknown>{ type: 123 })],
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

    it('rejects non-object actions', () => {
      expect(() => validateAction(<unknown>'action')).toThrow('Action must be an object')
      expect(() => validateAction(<unknown>123)).toThrow('Action must be an object')
    })

    it('rejects action without type', () => {
      const action = { ...validAction }
      delete (<Record<string, unknown>>action)['type']
      expect(() => validateAction(action)).toThrow('Action must have a string type')
    })

    it('rejects action with non-string type', () => {
      const action = { ...validAction, type: 123 }
      expect(() => validateAction(action)).toThrow('Action must have a string type')
    })

    it('rejects action without senderId', () => {
      const action = { ...validAction }
      delete (<Record<string, unknown>>action)['senderId']
      expect(() => validateAction(action)).toThrow('Action must have a valid UUID senderId')
    })

    it('rejects action with invalid senderId', () => {
      const action = { ...validAction, senderId: 'not-a-uuid' }
      expect(() => validateAction(action)).toThrow('Action must have a valid UUID senderId')
    })

    it('rejects action without timestamp', () => {
      const action = { ...validAction }
      delete (<Record<string, unknown>>action)['timestamp']
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
    it('acceptss valid http origins', () => {
      expect(() => validateOrigin('http://example.com')).not.toThrow()
      expect(() => validateOrigin('http://localhost:3000')).not.toThrow()
    })

    it('acceptss valid https origins', () => {
      expect(() => validateOrigin('https://example.com')).not.toThrow()
      expect(() => validateOrigin('https://api.example.com')).not.toThrow()
    })

    it('acceptss wildcard origin', () => {
      expect(() => validateOrigin('*')).not.toThrow()
    })

    it('rejects null origin', () => {
      expect(() => validateOrigin(<string>(<unknown>null))).toThrow('Origin cannot be null or undefined')
    })

    it('rejects undefined origin', () => {
      expect(() => validateOrigin(<string>(<unknown>undefined))).toThrow('Origin cannot be null or undefined')
    })

    it('rejects non-string origins', () => {
      expect(() => validateOrigin(<string>(<unknown>123))).toThrow('Origin must be a string')
      expect(() => validateOrigin(<string>(<unknown>{}))).toThrow('Origin must be a string')
    })

    it('rejects empty string', () => {
      expect(() => validateOrigin('')).toThrow('Origin cannot be empty')
      expect(() => validateOrigin('   ')).toThrow('Origin cannot be empty')
    })

    it('rejects invalid URLs', () => {
      expect(() => validateOrigin('not-a-url')).toThrow('Invalid origin URL')
      expect(() => validateOrigin('://broken')).toThrow('Invalid origin URL')
    })

    it('rejects non-http(s) protocols', () => {
      expect(() => validateOrigin('ftp://example.com')).toThrow('Origin must use http or https protocol')
      expect(() => validateOrigin('file:///path/to/file')).toThrow('Origin must use http or https protocol')
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

    it('acceptss valid settings with queueMessages', () => {
      expect(() => validateSettings({ queueMessages: true })).not.toThrow()
      expect(() => validateSettings({ queueMessages: false })).not.toThrow()
    })

    it('acceptss valid settings with debug', () => {
      expect(() => validateSettings({ logLevel: 'debug' })).not.toThrow()
      expect(() => validateSettings({ logLevel: 'error' })).not.toThrow()
    })

    it('acceptss valid settings with origin', () => {
      expect(() => validateSettings({ origin: 'http://example.com' })).not.toThrow()
      expect(() => validateSettings({ origin: '*' })).not.toThrow()
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

    it('rejects non-object settings', () => {
      expect(() => validateSettings(<unknown>'settings')).toThrow('Settings must be an object')
      expect(() => validateSettings(<unknown>123)).toThrow('Settings must be an object')
      expect(() => validateSettings(<unknown>[])).toThrow('Settings must be an object')
    })

    it('rejects invalid queueMessages type', () => {
      expect(() => validateSettings({ queueMessages: <unknown>'true' })).toThrow('Setting queueMessages must be a boolean')
      expect(() => validateSettings({ queueMessages: <unknown>1 })).toThrow('Setting queueMessages must be a boolean')
    })

    it('rejects invalid debug type', () => {
      expect(() => validateSettings({ debug: <unknown>'true' })).toThrow('Setting debug must be a boolean')
      expect(() => validateSettings({ debug: <unknown>1 })).toThrow('Setting debug must be a boolean')
    })

    it('rejects invalid origin type', () => {
      expect(() => validateSettings({ origin: <unknown>123 })).toThrow('Setting origin must be a string')
      expect(() => validateSettings({ origin: <unknown>{} })).toThrow('Setting origin must be a string')
    })

    it('rejects invalid contract type', () => {
      expect(() => validateSettings({ contract: <unknown>'contract' })).toThrow('Setting contract must be an object')
      expect(() => validateSettings({ contract: <unknown>123 })).toThrow('Setting contract must be an object')
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
