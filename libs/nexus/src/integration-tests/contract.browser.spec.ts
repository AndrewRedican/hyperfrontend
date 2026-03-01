import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { mergeContracts } from '../setup/merge-contracts'
import { createMockWindow } from './test-utils'

describe('Integration: Contract Validation', () => {
  let mockWindow: MockWindow

  beforeEach(() => {
    mockWindow = createMockWindow()
  })

  const baseContract: IChannelContract = {
    emitted: [{ type: 'BASE_EMIT' }],
    accepted: [{ type: 'BASE_ACCEPT' }],
  }

  describe('Contract Validation', () => {
    it('accepts valid contract', () => {
      expect(() => {
        createBroker({
          name: 'test-broker',
          contract: baseContract,
          settings: { logLevel: 'error' },
        })
      }).not.toThrow()
    })

    it('validates contract with multiple action types', () => {
      const complexContract: IChannelContract = {
        emitted: [{ type: 'ACTION_1' }, { type: 'ACTION_2' }, { type: 'ACTION_3' }],
        accepted: [{ type: 'RESPONSE_1' }, { type: 'RESPONSE_2' }],
      }

      const broker = createBroker({
        name: 'test-broker',
        contract: complexContract,
        settings: { logLevel: 'error' },
      })

      expect(broker.acceptedActionTypes).toHaveLength(2)
      expect(broker.acceptedActionTypes).toContain('RESPONSE_1')
      expect(broker.acceptedActionTypes).toContain('RESPONSE_2')
    })

    it('handles contract with optional fields', () => {
      const contractWithDescription: IChannelContract = {
        emitted: [{ type: 'EMIT_1', description: 'Test emission' }],
        accepted: [{ type: 'ACCEPT_1', description: 'Test acceptance' }],
      }

      const broker = createBroker({
        name: 'test-broker',
        contract: contractWithDescription,
        settings: { logLevel: 'error' },
      })

      expect(broker.contract).toEqual(contractWithDescription)
    })
  })

  describe('Contract Extension', () => {
    it('extends contract when enabled', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: baseContract,
        settings: {
          contractExtension: true,
        },
      })

      const extension: IChannelContract = {
        emitted: [{ type: 'EXTENDED_EMIT' }],
        accepted: [{ type: 'EXTENDED_ACCEPT' }],
      }

      broker.extendContract(extension)

      const updatedContract = broker.contract

      // Should contain both base and extension actions
      expect(updatedContract.emitted).toHaveLength(2)
      expect(updatedContract.accepted).toHaveLength(2)
    })

    it('throws error when extension is disabled', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: baseContract,
        settings: {
          contractExtension: false,
        },
      })

      const extension: IChannelContract = {
        emitted: [{ type: 'EXTENDED_EMIT' }],
        accepted: [{ type: 'EXTENDED_ACCEPT' }],
      }

      expect(() => {
        broker.extendContract(extension)
      }).toThrow()
    })

    it('chains contract extensions', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: baseContract,
        settings: {
          contractExtension: true,
        },
      })

      const ext1: IChannelContract = {
        emitted: [{ type: 'EXT_1_EMIT' }],
        accepted: [{ type: 'EXT_1_ACCEPT' }],
      }

      const ext2: IChannelContract = {
        emitted: [{ type: 'EXT_2_EMIT' }],
        accepted: [{ type: 'EXT_2_ACCEPT' }],
      }

      broker.extendContract(ext1).extendContract(ext2)

      const finalContract = broker.contract

      // Should contain base + ext1 + ext2
      expect(finalContract.emitted).toHaveLength(3)
      expect(finalContract.accepted).toHaveLength(3)
    })
  })

  describe('Contract Merging', () => {
    it('merges two contracts', () => {
      const contract1: IChannelContract = {
        emitted: [{ type: 'A1' }],
        accepted: [{ type: 'B1' }],
      }

      const contract2: IChannelContract = {
        emitted: [{ type: 'A2' }],
        accepted: [{ type: 'B2' }],
      }

      const merged = mergeContracts(contract1, contract2)

      expect(merged.emitted).toHaveLength(2)
      expect(merged.accepted).toHaveLength(2)
    })

    it('handles duplicate action types in merge', () => {
      const contract1: IChannelContract = {
        emitted: [{ type: 'SHARED' }],
        accepted: [{ type: 'UNIQUE_1' }],
      }

      const contract2: IChannelContract = {
        emitted: [{ type: 'SHARED' }],
        accepted: [{ type: 'UNIQUE_2' }],
      }

      const merged = mergeContracts(contract1, contract2)

      // Duplicate 'SHARED' should only appear once
      const sharedCount = merged.emitted.filter((a) => a.type === 'SHARED').length
      expect(sharedCount).toBe(1)
      expect(merged.accepted).toHaveLength(2)
    })

    it('merges multiple contracts', () => {
      const c1: IChannelContract = {
        emitted: [{ type: 'A' }],
        accepted: [{ type: 'B' }],
      }

      const c2: IChannelContract = {
        emitted: [{ type: 'C' }],
        accepted: [{ type: 'D' }],
      }

      const c3: IChannelContract = {
        emitted: [{ type: 'E' }],
        accepted: [{ type: 'F' }],
      }

      const merged = mergeContracts(mergeContracts(c1, c2), c3)

      expect(merged.emitted).toHaveLength(3)
      expect(merged.accepted).toHaveLength(3)
    })

    it('preserves action descriptions when merging', () => {
      const c1: IChannelContract = {
        emitted: [{ type: 'A', description: 'Action A' }],
        accepted: [{ type: 'B', description: 'Action B' }],
      }

      const c2: IChannelContract = {
        emitted: [{ type: 'C', description: 'Action C' }],
        accepted: [{ type: 'D', description: 'Action D' }],
      }

      const merged = mergeContracts(c1, c2)

      const actionA = merged.emitted.find((a) => a.type === 'A')
      expect(actionA?.description).toBe('Action A')

      const actionC = merged.emitted.find((a) => a.type === 'C')
      expect(actionC?.description).toBe('Action C')
    })
  })

  describe('Contract in Channel Communication', () => {
    it('validates messages against contract', () => {
      const strictContract: IChannelContract = {
        emitted: [{ type: 'ALLOWED_EMIT' }],
        accepted: [{ type: 'ALLOWED_ACCEPT' }],
      }

      const broker = createBroker({
        name: 'strict-broker',
        contract: strictContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('test-channel', mockWindow as unknown as Window)
      channel.connect()

      // Sending allowed type should work
      expect(() => {
        channel.send('ALLOWED_EMIT', {})
      }).not.toThrow()

      // Sending non-contract type should throw an error
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel.send('NOT_IN_CONTRACT' as any, {})
      }).toThrow('not in the emitted actions')
    })

    it('uses contract for all channels from same broker', () => {
      const sharedContract: IChannelContract = {
        emitted: [{ type: 'SHARED_EMIT' }],
        accepted: [{ type: 'SHARED_ACCEPT' }],
      }

      const broker = createBroker({
        name: 'shared-broker',
        contract: sharedContract,
        settings: { logLevel: 'error' },
      })

      const mockWindow2 = createMockWindow()

      const channel1 = broker.addChannel('channel-1', mockWindow as unknown as Window)
      const channel2 = broker.addChannel('channel-2', mockWindow2 as unknown as Window)

      channel1.connect()
      channel2.connect()

      // Both channels should use same contract
      expect(() => {
        channel1.send('SHARED_EMIT', {})
        channel2.send('SHARED_EMIT', {})
      }).not.toThrow()
    })
  })

  describe('Real-World Contract Scenarios', () => {
    it('handles API-style contract', () => {
      const apiContract: IChannelContract = {
        emitted: [
          { type: 'API_REQUEST', description: 'Client sends API request' },
          { type: 'API_CANCEL', description: 'Client cancels request' },
        ],
        accepted: [
          { type: 'API_RESPONSE', description: 'Server sends response' },
          { type: 'API_ERROR', description: 'Server sends error' },
          { type: 'API_PROGRESS', description: 'Server sends progress update' },
        ],
      }

      const broker = createBroker({
        name: 'api-broker',
        contract: apiContract,
        settings: { logLevel: 'error' },
      })

      expect(broker.acceptedActionTypes).toHaveLength(3)
      expect(broker.acceptedActionTypes).toContain('API_RESPONSE')
      expect(broker.acceptedActionTypes).toContain('API_ERROR')
      expect(broker.acceptedActionTypes).toContain('API_PROGRESS')
    })

    it('handles bidirectional contract', () => {
      const bidirectionalContract: IChannelContract = {
        emitted: [{ type: 'PING' }, { type: 'DATA_SEND' }],
        accepted: [{ type: 'PONG' }, { type: 'DATA_RECEIVE' }],
      }

      const broker = createBroker({
        name: 'bidirectional-broker',
        contract: bidirectionalContract,
        settings: { logLevel: 'error' },
      })

      const channel = broker.addChannel('bidirectional-channel', mockWindow as unknown as Window)
      channel.connect()

      // Can send in both directions
      expect(() => {
        channel.send('PING', {})
        channel.send('DATA_SEND', { payload: 'test' })
      }).not.toThrow()
    })

    it('handles microservices contract pattern', () => {
      const serviceContract: IChannelContract = {
        emitted: [{ type: 'SERVICE_QUERY' }, { type: 'SERVICE_COMMAND' }, { type: 'SERVICE_SUBSCRIBE' }],
        accepted: [{ type: 'SERVICE_RESULT' }, { type: 'SERVICE_EVENT' }, { type: 'SERVICE_ERROR' }],
      }

      const broker = createBroker({
        name: 'microservice-broker',
        contract: serviceContract,
        settings: { contractExtension: true },
      })

      // Extend with additional service capabilities
      const authExtension: IChannelContract = {
        emitted: [{ type: 'AUTH_LOGIN' }, { type: 'AUTH_LOGOUT' }],
        accepted: [{ type: 'AUTH_TOKEN' }, { type: 'AUTH_EXPIRED' }],
      }

      broker.extendContract(authExtension)

      expect(broker.contract.emitted).toHaveLength(5)
      expect(broker.contract.accepted).toHaveLength(5)
    })
  })

  describe('Contract Error Handling', () => {
    it('throws error for invalid contract structure', () => {
      expect(() => {
        createBroker({
          name: 'test-broker',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contract: {} as any, // Missing emitted/accepted
          settings: { logLevel: 'error' },
        })
      }).toThrow()
    })

    it('throws error for empty action types', () => {
      expect(() => {
        createBroker({
          name: 'test-broker',
          contract: {
            emitted: [{ type: '' }], // Empty type
            accepted: [{ type: 'VALID' }],
          },
          settings: { logLevel: 'error' },
        })
      }).toThrow()
    })

    it('throws error for null contract', () => {
      expect(() => {
        createBroker({
          name: 'test-broker',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          contract: null as any,
          settings: { logLevel: 'error' },
        })
      }).toThrow()
    })
  })
})
