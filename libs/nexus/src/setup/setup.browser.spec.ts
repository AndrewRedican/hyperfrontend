import type { IChannelContract } from '../types/contract'
import { setupBroker } from './broker'
import { mergeContracts } from './merge-contracts'

describe('Setup Utilities', () => {
  describe('setupBroker', () => {
    const defaultContract: IChannelContract = {
      accepted: [{ type: 'test' }],
      emitted: [{ type: 'response' }],
    }

    it('creates broker with name', () => {
      const broker = setupBroker({ name: 'test-broker', contract: defaultContract })

      expect(broker).toBeDefined()
      expect(broker.name).toBe('test-broker')
      expect(broker.id).toBeDefined()
    })

    it('creates broker with debug enabled', () => {
      const broker = setupBroker({ name: 'debug-broker', logLevel: 'debug', contract: defaultContract })

      expect(broker).toBeDefined()
      expect(broker.name).toBe('debug-broker')
    })

    it('creates broker with custom settings', () => {
      const broker = setupBroker({
        name: 'custom-broker',

        contract: defaultContract,
        originWhitelist: ['https://example.com'],
      })

      expect(broker).toBeDefined()
      expect(broker.name).toBe('custom-broker')
    })

    it('creates multiple independent brokers', () => {
      const broker1 = setupBroker({ name: 'broker-1', contract: defaultContract })
      const broker2 = setupBroker({ name: 'broker-2', contract: defaultContract })

      expect(broker1.id).not.toBe(broker2.id)
      expect(broker1.name).toBe('broker-1')
      expect(broker2.name).toBe('broker-2')
    })

    it('provides broker API methods', () => {
      const broker = setupBroker({ name: 'api-test', contract: defaultContract })

      expect(typeof broker.addChannel).toBe('function')
      expect(typeof broker.removeChannel).toBe('function')
      expect(typeof broker.getChannel).toBe('function')
      expect(Array.isArray(broker.channels)).toBe(true)
      expect(typeof broker.id).toBe('string')
      expect(typeof broker.name).toBe('string')
    })
  })

  describe('mergeContracts', () => {
    it('merges two simple contracts', () => {
      const contract1: IChannelContract = {
        accepted: [{ type: 'message' }],
        emitted: [{ type: 'response' }],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'request' }],
        emitted: [{ type: 'result' }],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted).toHaveLength(2)
      expect(merged.emitted).toHaveLength(2)
      expect(merged.accepted).toContainEqual({ type: 'message' })
      expect(merged.accepted).toContainEqual({ type: 'request' })
      expect(merged.emitted).toContainEqual({ type: 'response' })
      expect(merged.emitted).toContainEqual({ type: 'result' })
    })

    it('deduplicates action types', () => {
      const contract1: IChannelContract = {
        accepted: [{ type: 'message' }],
        emitted: [{ type: 'response' }],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'message' }],
        emitted: [{ type: 'response' }],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted).toHaveLength(1)
      expect(merged.emitted).toHaveLength(1)
      expect(merged.accepted[0].type).toBe('message')
      expect(merged.emitted[0].type).toBe('response')
    })

    it('merges multiple contracts', () => {
      const contract1: IChannelContract = {
        accepted: [{ type: 'a' }],
        emitted: [{ type: 'b' }],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'c' }],
        emitted: [{ type: 'd' }],
      }

      const contract3: IChannelContract = {
        accepted: [{ type: 'e' }],
        emitted: [{ type: 'f' }],
      }

      const merged = mergeContracts(contract1, contract2, contract3)

      expect(merged.accepted).toHaveLength(3)
      expect(merged.emitted).toHaveLength(3)
      expect(merged.accepted.map((a) => a.type)).toEqual(['a', 'c', 'e'])
      expect(merged.emitted.map((a) => a.type)).toEqual(['b', 'd', 'f'])
    })

    it('handles empty contracts', () => {
      const contract1: IChannelContract = {
        accepted: [],
        emitted: [],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'test' }],
        emitted: [{ type: 'result' }],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted).toHaveLength(1)
      expect(merged.emitted).toHaveLength(1)
    })

    it('return empty contract when merging empty contracts', () => {
      const contract1: IChannelContract = {
        accepted: [],
        emitted: [],
      }

      const contract2: IChannelContract = {
        accepted: [],
        emitted: [],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted).toEqual([])
      expect(merged.emitted).toEqual([])
    })

    it('preserves action descriptions', () => {
      const contract1: IChannelContract = {
        accepted: [{ type: 'message', description: 'Send message' }],
        emitted: [{ type: 'response', description: 'Response to message' }],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'request', description: 'Make request' }],
        emitted: [{ type: 'result', description: 'Request result' }],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted[0].description).toBe('Send message')
      expect(merged.accepted[1].description).toBe('Make request')
      expect(merged.emitted[0].description).toBe('Response to message')
      expect(merged.emitted[1].description).toBe('Request result')
    })

    it('preserves action schemas', () => {
      const schema1 = { type: 'object', properties: { text: { type: 'string' } } }
      const schema2 = { type: 'object', properties: { id: { type: 'number' } } }

      const contract1: IChannelContract = {
        accepted: [{ type: 'message', schema: schema1 }],
        emitted: [],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'request', schema: schema2 }],
        emitted: [],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted[0].schema).toEqual(schema1)
      expect(merged.accepted[1].schema).toEqual(schema2)
    })

    it('handles contracts with only accepted actions', () => {
      const contract1: IChannelContract = {
        accepted: [{ type: 'a' }, { type: 'b' }],
        emitted: [],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'c' }],
        emitted: [],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted).toHaveLength(3)
      expect(merged.emitted).toHaveLength(0)
    })

    it('handles contracts with only emitted actions', () => {
      const contract1: IChannelContract = {
        accepted: [],
        emitted: [{ type: 'x' }, { type: 'y' }],
      }

      const contract2: IChannelContract = {
        accepted: [],
        emitted: [{ type: 'z' }],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted).toHaveLength(0)
      expect(merged.emitted).toHaveLength(3)
    })

    it('handles invalid contracts gracefully', () => {
      const validContract: IChannelContract = {
        accepted: [{ type: 'test' }],
        emitted: [{ type: 'result' }],
      }

      const invalidContract = null as unknown as IChannelContract

      const merged = mergeContracts(validContract, invalidContract)

      expect(merged.accepted).toHaveLength(1)
      expect(merged.emitted).toHaveLength(1)
    })

    it('handles contracts missing properties gracefully', () => {
      const validContract: IChannelContract = {
        accepted: [{ type: 'test' }],
        emitted: [{ type: 'result' }],
      }

      const partialContract = { accepted: [{ type: 'partial' }] } as unknown as IChannelContract

      const merged = mergeContracts(validContract, partialContract)

      expect(merged.accepted).toContainEqual({ type: 'test' })
      expect(merged.emitted).toContainEqual({ type: 'result' })
    })

    it('creates new contract object (immutability)', () => {
      const contract1: IChannelContract = {
        accepted: [{ type: 'a' }],
        emitted: [{ type: 'b' }],
      }

      const contract2: IChannelContract = {
        accepted: [{ type: 'c' }],
        emitted: [{ type: 'd' }],
      }

      const merged = mergeContracts(contract1, contract2)

      merged.accepted.push({ type: 'new' })

      expect(contract1.accepted).toHaveLength(1)
      expect(contract2.accepted).toHaveLength(1)
    })

    it('handles single contract', () => {
      const contract: IChannelContract = {
        accepted: [{ type: 'a' }],
        emitted: [{ type: 'b' }],
      }

      const merged = mergeContracts(contract)

      expect(merged.accepted).toEqual([{ type: 'a' }])
      expect(merged.emitted).toEqual([{ type: 'b' }])
    })

    it('handles no contracts', () => {
      const merged = mergeContracts()

      expect(merged.accepted).toEqual([])
      expect(merged.emitted).toEqual([])
    })

    it('merges complex contracts with full action descriptions', () => {
      const contract1: IChannelContract = {
        accepted: [
          {
            type: 'user:login',
            description: 'User login action',
            schema: { type: 'object', properties: { username: { type: 'string' } } },
          },
        ],
        emitted: [
          {
            type: 'user:logged-in',
            description: 'User logged in event',
            schema: { type: 'object', properties: { userId: { type: 'string' } } },
          },
        ],
      }

      const contract2: IChannelContract = {
        accepted: [
          {
            type: 'user:logout',
            description: 'User logout action',
            schema: { type: 'object' },
          },
        ],
        emitted: [
          {
            type: 'user:logged-out',
            description: 'User logged out event',
            schema: { type: 'object' },
          },
        ],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.accepted).toHaveLength(2)
      expect(merged.emitted).toHaveLength(2)
      expect(merged.accepted.find((a) => a.type === 'user:login')?.description).toBe('User login action')
      expect(merged.accepted.find((a) => a.type === 'user:logout')?.description).toBe('User logout action')
      expect(merged.emitted.find((a) => a.type === 'user:logged-in')?.description).toBe('User logged in event')
      expect(merged.emitted.find((a) => a.type === 'user:logged-out')?.description).toBe('User logged out event')
    })
  })

  describe('Integration', () => {
    it('works together for complete broker setup', () => {
      const baseContract: IChannelContract = {
        accepted: ['ping', 'getData'].map((type) => ({ type })),
        emitted: ['pong', 'data'].map((type) => ({ type })),
      }

      const extendedContract: IChannelContract = {
        accepted: ['update', 'delete'].map((type) => ({ type })),
        emitted: ['updated', 'deleted'].map((type) => ({ type })),
      }

      const fullContract = mergeContracts(baseContract, extendedContract)

      const broker = setupBroker({
        name: 'integrated-broker',
        logLevel: 'debug',
        contract: fullContract,
      })

      expect(broker).toBeDefined()
      expect(fullContract.accepted).toHaveLength(4)
      expect(fullContract.emitted).toHaveLength(4)
    })
  })
})
