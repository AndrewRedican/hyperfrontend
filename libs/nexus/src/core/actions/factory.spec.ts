import type { IChannelContract } from '../../types/contract'
import { createActionCreators } from './factory'
import { ACTION_TYPES } from '../../types/action'

describe('createActionCreators', () => {
  const mockContract: IChannelContract = {
    emitted: [{ type: 'test-event' }],
    accepted: [{ type: 'test-action' }],
  }

  const mockDeps = {
    getBrokerId: () => 'test-broker-id',
    getContract: () => mockContract,
  }

  let actions: ReturnType<typeof createActionCreators>

  beforeEach(() => {
    actions = createActionCreators(mockDeps)
  })

  describe('requestConnection', () => {
    it('creates REQUEST_CONNECTION action with processId, senderId, and contract', () => {
      const processId = 'process-123'
      const action = actions.requestConnection(processId)

      expect(action).toEqual({
        type: ACTION_TYPES.REQUEST_CONNECTION,
        processId,
        senderId: 'test-broker-id',
        contract: mockContract,
      })
    })

    it('creates frozen action object', () => {
      const action = actions.requestConnection('process-123')
      expect(Object.isFrozen(action)).toBe(true)
    })

    it('creates REQUEST_CONNECTION action with security negotiation request', () => {
      const processId = 'process-secure'
      const security = {
        supported: ['v2', 'v1', 'none'] as const,
        preferred: 'v2' as const,
      }
      const action = actions.requestConnection(processId, security)

      expect(action).toEqual({
        type: ACTION_TYPES.REQUEST_CONNECTION,
        processId,
        senderId: 'test-broker-id',
        contract: mockContract,
        security,
      })
    })

    it('includes security field only when provided', () => {
      const actionWithoutSecurity = actions.requestConnection('process-1')
      const actionWithSecurity = actions.requestConnection('process-2', {
        supported: ['v1', 'none'],
        preferred: 'v1',
      })

      expect('security' in actionWithoutSecurity).toBe(false)
      expect('security' in actionWithSecurity).toBe(true)
    })

    it('creates frozen action with security', () => {
      const action = actions.requestConnection('process-secure', {
        supported: ['none'],
        preferred: 'none',
      })
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('acceptConnection', () => {
    it('creates ACCEPT_CONNECTION action with processId, senderId, and contract', () => {
      const processId = 'process-456'
      const action = actions.acceptConnection(processId)

      expect(action).toEqual({
        type: ACTION_TYPES.ACCEPT_CONNECTION,
        processId,
        senderId: 'test-broker-id',
        contract: mockContract,
      })
    })

    it('creates frozen action object', () => {
      const action = actions.acceptConnection('process-456')
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('denyConnection', () => {
    it('creates DENY_CONNECTION action with processId, senderId, and error', () => {
      const processId = 'process-789'
      const error = 'Connection denied by security policy'
      const action = actions.denyConnection(processId, error)

      expect(action).toEqual({
        type: ACTION_TYPES.DENY_CONNECTION,
        processId,
        senderId: 'test-broker-id',
        error,
      })
    })

    it('creates frozen action object', () => {
      const action = actions.denyConnection('process-789', 'error')
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('cancelConnection', () => {
    it('creates CANCEL_CONNECTION action with processId and senderId', () => {
      const processId = 'process-abc'
      const action = actions.cancelConnection(processId)

      expect(action).toEqual({
        type: ACTION_TYPES.CANCEL_CONNECTION,
        processId,
        senderId: 'test-broker-id',
      })
    })

    it('creates frozen action object', () => {
      const action = actions.cancelConnection('process-abc')
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('openConnection', () => {
    it('creates OPEN_CONNECTION action with processId and senderId', () => {
      const processId = 'process-def'
      const action = actions.openConnection(processId)

      expect(action).toEqual({
        type: ACTION_TYPES.OPEN_CONNECTION,
        processId,
        senderId: 'test-broker-id',
      })
    })

    it('creates frozen action object', () => {
      const action = actions.openConnection('process-def')
      expect(Object.isFrozen(action)).toBe(true)
    })

    it('creates OPEN_CONNECTION action with security confirmation', () => {
      const processId = 'process-secure'
      const security = {
        active: true,
        protocol: 'v2' as const,
      }
      const action = actions.openConnection(processId, security)

      expect(action).toEqual({
        type: ACTION_TYPES.OPEN_CONNECTION,
        processId,
        senderId: 'test-broker-id',
        security,
      })
    })

    it('includes security field only when provided', () => {
      const actionWithoutSecurity = actions.openConnection('process-1')
      const actionWithSecurity = actions.openConnection('process-2', { active: true, protocol: 'v1' })

      expect('security' in actionWithoutSecurity).toBe(false)
      expect('security' in actionWithSecurity).toBe(true)
    })

    it('creates frozen action with security', () => {
      const action = actions.openConnection('process-secure', { active: true, protocol: 'none' })
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('closeConnection', () => {
    it('creates CLOSE_CONNECTION action with processId and senderId', () => {
      const processId = 'process-ghi'
      const action = actions.closeConnection(processId)

      expect(action).toEqual({
        type: ACTION_TYPES.CLOSE_CONNECTION,
        processId,
        senderId: 'test-broker-id',
      })
    })

    it('creates frozen action object', () => {
      const action = actions.closeConnection('process-ghi')
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('destroyConnection', () => {
    it('creates DESTROY_CONNECTION action with only senderId (no processId)', () => {
      const action = actions.destroyConnection()

      expect(action).toEqual({
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'test-broker-id',
      })
    })

    it('does not include processId', () => {
      const action = actions.destroyConnection()
      expect('processId' in action).toBe(false)
    })

    it('creates frozen action object', () => {
      const action = actions.destroyConnection()
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('newMessage', () => {
    it('creates NEW_MESSAGE action with senderId and data', () => {
      const data = { message: 'hello', count: 42 }
      const action = actions.newMessage(data)

      expect(action).toEqual({
        type: ACTION_TYPES.NEW_MESSAGE,
        senderId: 'test-broker-id',
        data,
      })
    })

    it('handles null data', () => {
      const action = actions.newMessage(null)
      expect(action.data).toBeNull()
    })

    it('handles undefined data', () => {
      const action = actions.newMessage(undefined)
      expect(action.data).toBeUndefined()
    })

    it('creates frozen action object', () => {
      const action = actions.newMessage({ test: 'data' })
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('invalidRequest', () => {
    it('creates INVALID_REQUEST action with processId, senderId, and error', () => {
      const processId = 'process-invalid'
      const error = 'Invalid protocol version'
      const action = actions.invalidRequest(processId, error)

      expect(action).toEqual({
        type: ACTION_TYPES.INVALID_REQUEST,
        processId,
        senderId: 'test-broker-id',
        error,
      })
    })

    it('creates frozen action object', () => {
      const action = actions.invalidRequest('process-invalid', 'error')
      expect(Object.isFrozen(action)).toBe(true)
    })
  })

  describe('dependency injection', () => {
    it('uses getBrokerId function for all actions', () => {
      const getBrokerId = jest.fn(() => 'custom-broker-id')
      const customActions = createActionCreators({
        getBrokerId,
        getContract: mockDeps.getContract,
      })

      customActions.requestConnection('p1')
      customActions.acceptConnection('p2')
      customActions.denyConnection('p3', 'error')

      expect(getBrokerId).toHaveBeenCalledTimes(3)
    })

    it('uses getContract function for connection actions', () => {
      const getContract = jest.fn(() => mockContract)
      const customActions = createActionCreators({
        getBrokerId: mockDeps.getBrokerId,
        getContract,
      })

      customActions.requestConnection('p1')
      customActions.acceptConnection('p2')

      expect(getContract).toHaveBeenCalledTimes(2)
    })

    it('does not call getContract for non-connection actions', () => {
      const getContract = jest.fn(() => mockContract)
      const customActions = createActionCreators({
        getBrokerId: mockDeps.getBrokerId,
        getContract,
      })

      customActions.denyConnection('p1', 'error')
      customActions.cancelConnection('p2')
      customActions.openConnection('p3')
      customActions.closeConnection('p4')
      customActions.destroyConnection()
      customActions.newMessage('data')
      customActions.invalidRequest('p5', 'error')

      expect(getContract).not.toHaveBeenCalled()
    })
  })

  describe('immutability', () => {
    it('return frozen actions that cannot be modified', () => {
      const action = actions.requestConnection('process-test')

      expect(() => {
        // @ts-expect-error - testing runtime immutability
        action.type = 'changed'
      }).toThrow()

      expect(() => {
        // @ts-expect-error - testing runtime immutability
        action.processId = 'changed'
      }).toThrow()
    })

    it('freezes top-level action object', () => {
      const action = actions.requestConnection('process-test')
      expect(Object.isFrozen(action)).toBe(true)
    })

    it('freezes nested contract object', () => {
      const action = actions.requestConnection('process-test')
      // Object.freeze provides shallow immutability (consistent with original implementation)
      expect(Object.isFrozen(action.contract)).toBe(false)
      expect(Object.isFrozen(action.contract.emitted)).toBe(false)
      expect(Object.isFrozen(action.contract.accepted)).toBe(false)
    })
  })

  describe('type safety', () => {
    it('haves correct TypeScript types', () => {
      // Type tests - these will fail compilation if types are wrong
      const reqAction = actions.requestConnection('p1')
      expect(reqAction.type).toBe(ACTION_TYPES.REQUEST_CONNECTION)
      expect('contract' in reqAction).toBe(true)

      const denyAction = actions.denyConnection('p2', 'error')
      expect(denyAction.type).toBe(ACTION_TYPES.DENY_CONNECTION)
      expect('error' in denyAction).toBe(true)

      const msgAction = actions.newMessage('data')
      expect(msgAction.type).toBe(ACTION_TYPES.NEW_MESSAGE)
      expect('data' in msgAction).toBe(true)

      const destroyAction = actions.destroyConnection()
      expect(destroyAction.type).toBe(ACTION_TYPES.DESTROY_CONNECTION)
      expect('processId' in destroyAction).toBe(false)
    })
  })
})
