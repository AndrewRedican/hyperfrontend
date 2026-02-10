import { createBroker } from './factory'
import type { IChannelContract } from '../types/contract'
import type { SecurityPolicy } from './types'

// Mock uuidV4 to return unique IDs
let uuidCounter = 0
jest.mock('@hyperfrontend/random-generator-utils', () => ({
  uuidV4: () => {
    uuidCounter++
    return `12345678-1234-1234-1234-12345678901${uuidCounter}`
  },
  isUuidV4: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}))

describe('createBroker', () => {
  const mockContract: IChannelContract = {
    accepted: [{ type: 'test-action', description: 'Test action' }],
    emitted: [],
  }

  beforeEach(() => {
    uuidCounter = 0
  })

  afterEach(() => {
    // Clean up any event listeners
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('creates broker with valid config', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(broker).toBeDefined()
      expect(broker.name).toBe('test-broker')
      expect(broker.id).toBeDefined()
    })

    it('generates unique ID for each broker', () => {
      const broker1 = createBroker({
        name: 'broker-1',
        contract: mockContract,
      })
      const broker2 = createBroker({
        name: 'broker-2',
        contract: mockContract,
      })

      expect(broker1.id).not.toBe(broker2.id)
    })

    it('applys default settings when not provided', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(broker.settings).toBeDefined()
      expect(broker.settings.debug).toBe(false)
    })

    it('merges custom settings with defaults', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          debug: true,
          whitelist: ['https://trusted.com'],
        },
      })

      expect(broker.settings.debug).toBe(true)
      expect(broker.settings.whitelist).toEqual(['https://trusted.com'])
    })

    it('throws error for invalid broker name', () => {
      expect(() =>
        createBroker({
          name: '',
          contract: mockContract,
        })
      ).toThrow()
    })

    it('throws error for invalid contract', () => {
      expect(() =>
        createBroker({
          name: 'test-broker',
          contract: <IChannelContract>(<unknown>{}),
        })
      ).toThrow()
    })
  })

  describe('properties', () => {
    it('exposes broker id', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(typeof broker.id).toBe('string')
      expect(broker.id.length).toBeGreaterThan(0)
    })

    it('exposes broker name', () => {
      const broker = createBroker({
        name: 'my-broker',
        contract: mockContract,
      })

      expect(broker.name).toBe('my-broker')
    })

    it('exposes settings', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: { debug: true },
      })

      expect(broker.settings).toBeDefined()
      expect(broker.settings.debug).toBe(true)
    })

    it('exposes debugMode flag', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: { debug: true },
      })

      expect(broker.debugMode).toBe(true)
    })

    it('exposes acceptedActionTypes', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(broker.acceptedActionTypes).toEqual(['test-action'])
    })

    it('exposes channels list', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(Array.isArray(broker.channels)).toBe(true)
      expect(broker.channels).toHaveLength(0)
    })
  })

  describe('channel management', () => {
    it('adds channel', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const mockWindow = <Window>{}
      const channel = broker.addChannel('test-channel', mockWindow)
      const found = broker.getChannel(mockWindow)

      expect(found).toBe(channel)
      expect(found?.name).toBe('test-channel')
    })

    it('get channel by id', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const mockWindow = <Window>{}
      const channel = broker.addChannel('test-channel', mockWindow)
      const found = broker.getChannel(channel.id)

      expect(found).toBe(channel)
    })

    it('get channel by name', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const mockWindow = <Window>{}
      const channel = broker.addChannel('test-channel', mockWindow)
      const found = broker.getChannel('test-channel')

      expect(found).toBe(channel)
    })

    it('get channel by window', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const mockWindow = <Window>{}
      const channel = broker.addChannel('test-channel', mockWindow)
      const found = broker.getChannel(mockWindow)

      expect(found).toBe(channel)
    })

    it('return null for unknown channel', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const found = broker.getChannel('unknown')

      expect(found).toBeNull()
    })

    it('removes channel', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const mockWindow = <Window>{}
      const channel = broker.addChannel('test-channel', mockWindow)

      broker.removeChannel(channel.id)
      const found = broker.getChannel(channel.id)

      expect(found).toBeNull()
    })
  })

  describe('security policy', () => {
    it('sets security policy', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const policy: SecurityPolicy = () => true

      expect(() => broker.setSecurityPolicy(policy)).not.toThrow()
    })

    it('validates security policy is a function', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(() => broker.setSecurityPolicy(<SecurityPolicy>(<unknown>'not-a-function'))).toThrow()
    })

    it('updates security policy', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const policy1: SecurityPolicy = () => true
      const policy2: SecurityPolicy = () => false

      broker.setSecurityPolicy(policy1)
      expect(broker.settings.securityPolicy).toBe(policy1)

      broker.setSecurityPolicy(policy2)
      expect(broker.settings.securityPolicy).toBe(policy2)
    })
  })

  describe('contract extension', () => {
    it('extend contract when enabled', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          contractExtension: true,
        },
      })

      const extension: IChannelContract = {
        accepted: [{ type: 'new-action', description: 'New action' }],
        emitted: [],
      }

      expect(() => broker.extendContract(extension)).not.toThrow()
    })

    it('throws error when contract extension disabled', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          contractExtension: false,
        },
      })

      const extension: IChannelContract = {
        accepted: [{ type: 'new-action', description: 'New action' }],
        emitted: [],
      }

      expect(() => broker.extendContract(extension)).toThrow('Original contract cannot be extended')
    })

    it('validates extension contract', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          contractExtension: true,
        },
      })

      expect(() => broker.extendContract(<IChannelContract>(<unknown>{}))).toThrow()
    })
  })

  describe('serialization', () => {
    it('serializes to JSON', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const json = broker.toJSON()

      expect(json).toHaveProperty('id')
      expect(json).toHaveProperty('name')
      expect(json).toHaveProperty('settings')
      expect(json).toHaveProperty('acceptedActionTypes')
      expect(json).toHaveProperty('debugMode')
      expect(json).toHaveProperty('channels')
    })

    it('includes broker properties in JSON', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: { debug: true },
      })

      const json = broker.toJSON()

      expect(json['name']).toBe('test-broker')
      expect(json['debugMode']).toBe(true)
      expect(json['acceptedActionTypes']).toEqual(['test-action'])
    })

    it('includes channels in JSON', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const mockWindow = <Window>{}
      broker.addChannel('test-channel', mockWindow)

      const json = broker.toJSON()

      expect(Array.isArray(json['channels'])).toBe(true)
      expect((<unknown[]>json['channels']).length).toBeGreaterThan(0)
    })
  })

  describe('protocol management', () => {
    it('registers v1 protocol from settings', () => {
      const mockV1Provider = { version: 'v1' }

      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          security: {
            protocols: { v1: mockV1Provider },
          },
        },
      })

      expect(broker.hasProtocol('v1')).toBe(true)
    })

    it('registers v2 protocol from settings', () => {
      const mockV2Provider = { version: 'v2' }

      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          security: {
            protocols: { v2: mockV2Provider },
          },
        },
      })

      expect(broker.hasProtocol('v2')).toBe(true)
    })

    it('registers both v1 and v2 protocols from settings', () => {
      const mockV1Provider = { version: 'v1' }
      const mockV2Provider = { version: 'v2' }

      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          security: {
            protocols: { v1: mockV1Provider, v2: mockV2Provider },
          },
        },
      })

      expect(broker.hasProtocol('v1')).toBe(true)
      expect(broker.hasProtocol('v2')).toBe(true)
      expect(broker.getSupportedProtocols()).toContain('v1')
      expect(broker.getSupportedProtocols()).toContain('v2')
    })

    it('registers protocol manually', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const mockProvider = { version: 'v1' }
      broker.registerProtocol('v1', mockProvider)

      expect(broker.hasProtocol('v1')).toBe(true)
    })

    it('returns broker for chaining when registering', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      const result = broker.registerProtocol('v1', { version: 'v1' })

      expect(result).toBe(broker)
    })

    it('unregisters protocol', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          security: {
            protocols: { v1: { version: 'v1' } },
          },
        },
      })

      expect(broker.hasProtocol('v1')).toBe(true)

      broker.unregisterProtocol('v1')

      expect(broker.hasProtocol('v1')).toBe(false)
    })

    it('returns broker for chaining when unregistering', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
        settings: {
          security: {
            protocols: { v1: { version: 'v1' } },
          },
        },
      })

      const result = broker.unregisterProtocol('v1')

      expect(result).toBe(broker)
    })

    it('returns none as default protocol', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(broker.getSupportedProtocols()).toContain('none')
    })

    it('returns false for unregistered protocol', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: mockContract,
      })

      expect(broker.hasProtocol('v1')).toBe(false)
      expect(broker.hasProtocol('v2')).toBe(false)
    })
  })
})
