import type { IChannelContract } from '../types/contract'
import { describe, expect, it } from '@hyperfrontend/testing'
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

      expect(broker).toEqual(expect.objectContaining({ name: 'test-broker', id: expect.anything() }))
    })

    it('creates broker with debug enabled', () => {
      const broker = setupBroker({ name: 'debug-broker', logLevel: 'debug', contract: defaultContract })

      expect(broker.name).toBe('debug-broker')
    })

    it('creates broker with custom settings', () => {
      const broker = setupBroker({
        name: 'custom-broker',

        contract: defaultContract,
        originWhitelist: ['https://example.com'],
      })

      expect(broker.name).toBe('custom-broker')
    })

    it('creates independent brokers with distinct ids', () => {
      const broker1 = setupBroker({ name: 'broker-1', contract: defaultContract })
      const broker2 = setupBroker({ name: 'broker-2', contract: defaultContract })

      expect(broker1.id).not.toBe(broker2.id)
    })

    it('creates independent brokers that keep their own names', () => {
      const broker1 = setupBroker({ name: 'broker-1', contract: defaultContract })
      const broker2 = setupBroker({ name: 'broker-2', contract: defaultContract })

      expect({ broker1: broker1.name, broker2: broker2.name }).toEqual({ broker1: 'broker-1', broker2: 'broker-2' })
    })

    it('provides broker API methods', () => {
      const broker = setupBroker({ name: 'api-test', contract: defaultContract })

      expect({
        addChannel: typeof broker.addChannel,
        removeChannel: typeof broker.removeChannel,
        getChannel: typeof broker.getChannel,
        channels: Array.isArray(broker.channels) ? 'array' : typeof broker.channels,
        id: typeof broker.id,
        name: typeof broker.name,
      }).toEqual({
        addChannel: 'function',
        removeChannel: 'function',
        getChannel: 'function',
        channels: 'array',
        id: 'string',
        name: 'string',
      })
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

      expect(merged).toEqual({
        accepted: [{ type: 'message' }, { type: 'request' }],
        emitted: [{ type: 'response' }, { type: 'result' }],
      })
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

      expect(merged).toEqual({ accepted: [{ type: 'message' }], emitted: [{ type: 'response' }] })
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

      expect({ accepted: merged.accepted.map((a) => a.type), emitted: merged.emitted.map((a) => a.type) }).toEqual({
        accepted: ['a', 'c', 'e'],
        emitted: ['b', 'd', 'f'],
      })
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

      expect(merged).toEqual({ accepted: [{ type: 'test' }], emitted: [{ type: 'result' }] })
    })

    it('returns an empty contract when merging empty contracts', () => {
      const contract1: IChannelContract = {
        accepted: [],
        emitted: [],
      }

      const contract2: IChannelContract = {
        accepted: [],
        emitted: [],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged).toEqual({ accepted: [], emitted: [] })
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

      expect({
        accepted: merged.accepted.map((action) => action.description),
        emitted: merged.emitted.map((action) => action.description),
      }).toEqual({
        accepted: ['Send message', 'Make request'],
        emitted: ['Response to message', 'Request result'],
      })
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

      expect(merged.accepted.map((action) => action.schema)).toEqual([schema1, schema2])
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

      expect(merged).toEqual({ accepted: [{ type: 'a' }, { type: 'b' }, { type: 'c' }], emitted: [] })
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

      expect(merged).toEqual({ accepted: [], emitted: [{ type: 'x' }, { type: 'y' }, { type: 'z' }] })
    })

    it('handles invalid contracts gracefully', () => {
      const validContract: IChannelContract = {
        accepted: [{ type: 'test' }],
        emitted: [{ type: 'result' }],
      }

      const invalidContract = null as unknown as IChannelContract

      const merged = mergeContracts(validContract, invalidContract)

      expect(merged).toEqual({ accepted: [{ type: 'test' }], emitted: [{ type: 'result' }] })
    })

    it('handles contracts missing properties gracefully', () => {
      const validContract: IChannelContract = {
        accepted: [{ type: 'test' }],
        emitted: [{ type: 'result' }],
      }

      const partialContract = { accepted: [{ type: 'partial' }] } as unknown as IChannelContract

      const merged = mergeContracts(validContract, partialContract)

      expect(merged).toEqual({
        accepted: expect.arrayContaining([{ type: 'test' }]),
        emitted: expect.arrayContaining([{ type: 'result' }]),
      })
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

      expect({ contract1: contract1.accepted, contract2: contract2.accepted }).toEqual({
        contract1: [{ type: 'a' }],
        contract2: [{ type: 'c' }],
      })
    })

    it('handles single contract', () => {
      const contract: IChannelContract = {
        accepted: [{ type: 'a' }],
        emitted: [{ type: 'b' }],
      }

      const merged = mergeContracts(contract)

      expect(merged).toEqual({ accepted: [{ type: 'a' }], emitted: [{ type: 'b' }] })
    })

    it('handles no contracts', () => {
      const merged = mergeContracts()

      expect(merged).toEqual({ accepted: [], emitted: [] })
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

      expect({
        accepted: merged.accepted.map(({ type, description }) => ({ type, description })),
        emitted: merged.emitted.map(({ type, description }) => ({ type, description })),
      }).toEqual({
        accepted: [
          { type: 'user:login', description: 'User login action' },
          { type: 'user:logout', description: 'User logout action' },
        ],
        emitted: [
          { type: 'user:logged-in', description: 'User logged in event' },
          { type: 'user:logged-out', description: 'User logged out event' },
        ],
      })
    })
  })

  describe('Integration', () => {
    const setUpFromMergedContracts = () => {
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

      return { fullContract, broker }
    }

    it('sets up a broker from merged contracts', () => {
      const { broker } = setUpFromMergedContracts()

      expect(broker).toBeDefined()
    })

    it('merges every action type into the contract the broker is set up with', () => {
      const { fullContract } = setUpFromMergedContracts()

      expect({
        accepted: fullContract.accepted.map(({ type }) => type),
        emitted: fullContract.emitted.map(({ type }) => type),
      }).toEqual({
        accepted: ['ping', 'getData', 'update', 'delete'],
        emitted: ['pong', 'data', 'updated', 'deleted'],
      })
    })
  })
})
