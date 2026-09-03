import { describe, expect, it } from '@hyperfrontend/testing'
import { type IChannelContract } from '../types/contract'
import { ConnectionError } from './connection-error'
import { ContractError } from './contract-error'
import { ValidationError } from './validation-error'

describe('Custom Error Classes', () => {
  describe('ValidationError', () => {
    it('creates error with message', () => {
      const error = new ValidationError('Validation failed')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.name).toBe('ValidationError')
      expect(error.message).toBe('Validation failed')
      expect(error.errors).toEqual([])
    })

    it('creates error with validation errors', () => {
      const validationErrors = [
        { message: 'Field required', path: 'name', code: 'REQUIRED' },
        { message: 'Invalid type', path: 'age', code: 'TYPE_ERROR' },
      ]
      const error = new ValidationError('Validation failed', validationErrors)

      expect(error.errors).toEqual(validationErrors)
      expect(error.errors).toHaveLength(2)
    })

    it('preserves stack trace', () => {
      const error = new ValidationError('Test error')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ValidationError')
    })

    it('supports instanceof checks', () => {
      const error = new ValidationError('Test')

      expect(error instanceof Error).toBe(true)
      expect(error instanceof ValidationError).toBe(true)
    })

    it('serializes to JSON', () => {
      const validationErrors = [{ message: 'Error', path: 'field', code: 'CODE' }]
      const error = new ValidationError('Failed', validationErrors)
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'ValidationError',
        message: 'Failed',
        errors: validationErrors,
      })
    })

    it('formats as string without errors', () => {
      const error = new ValidationError('Something went wrong')
      const str = error.toString()

      expect(str).toBe('ValidationError: Something went wrong')
    })

    it('formats as string with errors', () => {
      const validationErrors = [
        { message: 'Required field', path: 'name' },
        { message: 'Invalid format', path: 'email' },
      ]
      const error = new ValidationError('Validation failed', validationErrors)
      const str = error.toString()

      expect(str).toContain('ValidationError: Validation failed')
      expect(str).toContain('name: Required field')
      expect(str).toContain('email: Invalid format')
    })

    it('handles errors without path', () => {
      const validationErrors = [{ message: 'General error' }]
      const error = new ValidationError('Failed', validationErrors)
      const str = error.toString()

      expect(str).toContain('unknown: General error')
    })
  })

  describe('ConnectionError', () => {
    it('creates error with message only', () => {
      const error = new ConnectionError('Connection failed')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ConnectionError)
      expect(error.name).toBe('ConnectionError')
      expect(error.message).toBe('Connection failed')
      expect(error.channelId).toBeUndefined()
      expect(error.origin).toBeUndefined()
    })

    it('creates error with channel ID', () => {
      const error = new ConnectionError('Failed', 'channel-123')

      expect(error.channelId).toBe('channel-123')
      expect(error.origin).toBeUndefined()
    })

    it('creates error with channel ID and origin', () => {
      const error = new ConnectionError('Failed', 'channel-123', 'https://example.com')

      expect(error.channelId).toBe('channel-123')
      expect(error.origin).toBe('https://example.com')
    })

    it('preserves stack trace', () => {
      const error = new ConnectionError('Test error')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ConnectionError')
    })

    it('supports instanceof checks', () => {
      const error = new ConnectionError('Test')

      expect(error instanceof Error).toBe(true)
      expect(error instanceof ConnectionError).toBe(true)
    })

    it('serializes to JSON without optional fields', () => {
      const error = new ConnectionError('Failed')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'ConnectionError',
        message: 'Failed',
      })
    })

    it('serializes to JSON with channel ID', () => {
      const error = new ConnectionError('Failed', 'channel-123')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'ConnectionError',
        message: 'Failed',
        channelId: 'channel-123',
      })
    })

    it('serializes to JSON with all fields', () => {
      const error = new ConnectionError('Failed', 'channel-123', 'https://example.com')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'ConnectionError',
        message: 'Failed',
        channelId: 'channel-123',
        origin: 'https://example.com',
      })
    })
  })

  describe('ContractError', () => {
    it('creates error with message only', () => {
      const error = new ContractError('Invalid contract')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ContractError)
      expect(error.name).toBe('ContractError')
      expect(error.message).toBe('Invalid contract')
      expect(error.contract).toBeUndefined()
    })

    it('creates error with contract', () => {
      const contract: IChannelContract = {
        accepted: [{ type: 'message' }, { type: 'request' }],
        emitted: [{ type: 'response' }],
      }
      const error = new ContractError('Invalid contract', contract)

      expect(error.contract).toEqual(contract)
    })

    it('preserves stack trace', () => {
      const error = new ContractError('Test error')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('ContractError')
    })

    it('supports instanceof checks', () => {
      const error = new ContractError('Test')

      expect(error instanceof Error).toBe(true)
      expect(error instanceof ContractError).toBe(true)
    })

    it('serializes to JSON without contract', () => {
      const error = new ContractError('Failed')
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'ContractError',
        message: 'Failed',
      })
    })

    it('serializes to JSON with contract', () => {
      const contract: IChannelContract = {
        accepted: [{ type: 'test' }],
        emitted: [{ type: 'result' }],
      }
      const error = new ContractError('Failed', contract)
      const json = error.toJSON()

      expect(json).toEqual({
        name: 'ContractError',
        message: 'Failed',
        contract,
      })
    })

    it('handles empty contract', () => {
      const contract: IChannelContract = {
        accepted: [],
        emitted: [],
      }
      const error = new ContractError('Empty contract', contract)

      expect(error.contract).toEqual(contract)
    })
  })

  describe('Error hierarchy', () => {
    it('allows catching all as Error', () => {
      const errors = [
        new ValidationError('Validation failed'),
        new ConnectionError('Connection failed'),
        new ContractError('Contract failed'),
      ]

      errors.forEach((error) => {
        expect(error instanceof Error).toBe(true)
      })
    })

    it('distinguish between error types', () => {
      const validationError = new ValidationError('Test')
      const connectionError = new ConnectionError('Test')
      const contractError = new ContractError('Test')

      expect(validationError instanceof ValidationError).toBe(true)
      expect(validationError instanceof ConnectionError).toBe(false)
      expect(validationError instanceof ContractError).toBe(false)

      expect(connectionError instanceof ConnectionError).toBe(true)
      expect(connectionError instanceof ValidationError).toBe(false)
      expect(connectionError instanceof ContractError).toBe(false)

      expect(contractError instanceof ContractError).toBe(true)
      expect(contractError instanceof ValidationError).toBe(false)
      expect(contractError instanceof ConnectionError).toBe(false)
    })
  })
})
