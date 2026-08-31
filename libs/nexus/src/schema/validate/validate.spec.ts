import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { IMessage } from '../../types/message'
import { ACTION_TYPES } from '../../constants/action-types'
import { validateAction } from './action'
import { validateContract } from './contract'
import { createValidator } from './create-validator'
import { validateMessage } from './message'

describe('Schema Validation', () => {
  describe('createValidator', () => {
    it('creates a validator function', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }

      const validator = createValidator(schema)
      expect(typeof validator).toBe('function')
    })

    it('validates valid data', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }

      const validator = createValidator(schema)
      const result = validator({ name: 'Alice', age: 30 })

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects invalid data', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      }

      const validator = createValidator(schema)
      const result = validator({ age: 'not-a-number' })

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('provides error details', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      }

      const validator = createValidator(schema)
      const result = validator({ email: 123 })

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toHaveProperty('message')
    })
  })

  describe('validateAction', () => {
    it('validates a valid action', () => {
      const action: IAction = {
        type: ACTION_TYPES.REQUEST_CONNECTION,
        senderId: 'test-broker',
        processId: '550e8400-e29b-41d4-a716-446655440000',
        contract: {
          accepted: [],
          emitted: [],
        },
      }

      const result = validateAction(action)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects missing required fields', () => {
      const action = {
        type: ACTION_TYPES.REQUEST_CONNECTION,
      } as IAction

      const result = validateAction(action)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('detects invalid processId format', () => {
      const action = {
        type: ACTION_TYPES.REQUEST_CONNECTION,
        senderId: 'test-broker',
        processId: 'invalid-uuid',
        contract: {
          accepted: [],
          emitted: [],
        },
      } as IAction

      const result = validateAction(action)
      expect(result.valid).toBe(false)
    })

    it('validates DENY action with error', () => {
      const action = {
        type: ACTION_TYPES.DENY_CONNECTION,
        senderId: 'test-broker',
        processId: '550e8400-e29b-41d4-a716-446655440000',
        error: 'Connection not allowed',
      } as IAction

      const result = validateAction(action)
      expect(result.valid).toBe(true)
    })
  })

  describe('validateContract', () => {
    it('validates a valid contract', () => {
      const contract: IChannelContract = {
        accepted: [
          {
            type: 'user-login',
            schema: {
              type: 'object',
              properties: {
                username: { type: 'string' },
              },
            },
          },
        ],
        emitted: [
          {
            type: 'user-logged-in',
          },
        ],
      }

      const result = validateContract(contract)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects missing required properties', () => {
      const contract = {
        accepted: [],
      } as IChannelContract

      const result = validateContract(contract)
      expect(result.valid).toBe(false)
    })

    it('validates contract with empty accepted/emitted', () => {
      const contract: IChannelContract = {
        accepted: [],
        emitted: [],
      }

      const result = validateContract(contract)
      expect(result.valid).toBe(true)
    })
  })

  describe('validateMessage', () => {
    it('validates a valid message', () => {
      const message: IMessage = {
        type: 'user-login',
        data: { username: 'alice' },
      }

      const result = validateMessage(message)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects missing type', () => {
      const message = {
        data: { some: 'data' },
      } as IMessage

      const result = validateMessage(message)
      expect(result.valid).toBe(false)
    })

    it('allows message with only type', () => {
      const message: IMessage = {
        type: 'simple-notification',
      }

      const result = validateMessage(message)
      expect(result.valid).toBe(true)
    })

    it('allows custom properties', () => {
      const message: IMessage = {
        type: 'custom-message',
        data: { foo: 'bar' },
        timestamp: Date.now(),
        customProp: 'allowed',
      }

      const result = validateMessage(message)
      expect(result.valid).toBe(true)
    })
  })
})
