import { describe, expect, it } from '@hyperfrontend/testing'
import { type IChannelContract } from '../types/contract'
import { ConnectionError } from './connection-error'
import { ContractError } from './contract-error'
import { ValidationError } from './validation-error'

describe('Custom Error Classes', () => {
  describe('ValidationError', () => {
    it('creates error with message', () => {
      const error = new ValidationError('Validation failed')

      expect({
        isError: error instanceof Error,
        isValidationError: error instanceof ValidationError,
        name: error.name,
        message: error.message,
        errors: error.errors,
      }).toEqual({
        isError: true,
        isValidationError: true,
        name: 'ValidationError',
        message: 'Validation failed',
        errors: [],
      })
    })

    it('creates error with validation errors', () => {
      const validationErrors = [
        { message: 'Field required', path: 'name', code: 'REQUIRED' },
        { message: 'Invalid type', path: 'age', code: 'TYPE_ERROR' },
      ]
      const error = new ValidationError('Validation failed', validationErrors)

      expect(error.errors).toEqual(validationErrors)
    })

    it('preserves stack trace', () => {
      const error = new ValidationError('Test error')

      expect(error.stack).toContain('ValidationError')
    })

    it('supports instanceof checks', () => {
      const error = new ValidationError('Test')

      expect({ isError: error instanceof Error, isValidationError: error instanceof ValidationError }).toEqual({
        isError: true,
        isValidationError: true,
      })
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

      expect(str).toBe('ValidationError: Validation failed\n  - name: Required field\n  - email: Invalid format')
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

      expect({
        isError: error instanceof Error,
        isConnectionError: error instanceof ConnectionError,
        name: error.name,
        message: error.message,
        channelId: error.channelId,
        origin: error.origin,
      }).toEqual({
        isError: true,
        isConnectionError: true,
        name: 'ConnectionError',
        message: 'Connection failed',
        channelId: undefined,
        origin: undefined,
      })
    })

    it('creates error with channel ID', () => {
      const error = new ConnectionError('Failed', 'channel-123')

      expect({ channelId: error.channelId, origin: error.origin }).toEqual({ channelId: 'channel-123', origin: undefined })
    })

    it('creates error with channel ID and origin', () => {
      const error = new ConnectionError('Failed', 'channel-123', 'https://example.com')

      expect({ channelId: error.channelId, origin: error.origin }).toEqual({ channelId: 'channel-123', origin: 'https://example.com' })
    })

    it('preserves stack trace', () => {
      const error = new ConnectionError('Test error')

      expect(error.stack).toContain('ConnectionError')
    })

    it('supports instanceof checks', () => {
      const error = new ConnectionError('Test')

      expect({ isError: error instanceof Error, isConnectionError: error instanceof ConnectionError }).toEqual({
        isError: true,
        isConnectionError: true,
      })
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

      expect({
        isError: error instanceof Error,
        isContractError: error instanceof ContractError,
        name: error.name,
        message: error.message,
        contract: error.contract,
      }).toEqual({
        isError: true,
        isContractError: true,
        name: 'ContractError',
        message: 'Invalid contract',
        contract: undefined,
      })
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

      expect(error.stack).toContain('ContractError')
    })

    it('supports instanceof checks', () => {
      const error = new ContractError('Test')

      expect({ isError: error instanceof Error, isContractError: error instanceof ContractError }).toEqual({
        isError: true,
        isContractError: true,
      })
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
    const classify = (error: Error) => ({
      ValidationError: error instanceof ValidationError,
      ConnectionError: error instanceof ConnectionError,
      ContractError: error instanceof ContractError,
    })

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

    it('distinguishes a ValidationError from the other error types', () => {
      const validationError = new ValidationError('Test')

      expect(classify(validationError)).toEqual({ ValidationError: true, ConnectionError: false, ContractError: false })
    })

    it('distinguishes a ConnectionError from the other error types', () => {
      const connectionError = new ConnectionError('Test')

      expect(classify(connectionError)).toEqual({ ValidationError: false, ConnectionError: true, ContractError: false })
    })

    it('distinguishes a ContractError from the other error types', () => {
      const contractError = new ContractError('Test')

      expect(classify(contractError)).toEqual({ ValidationError: false, ConnectionError: false, ContractError: true })
    })
  })
})
