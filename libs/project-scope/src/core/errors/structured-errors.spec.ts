import { describe, it, expect } from '@hyperfrontend/testing'
import { createStructuredError, createConfigError, createFsError, createParseError, createValidationError } from './structured-errors'

describe('core/errors', () => {
  describe('createStructuredError', () => {
    it('creates error with code and context', () => {
      const error = createStructuredError('Test error', 'TEST_CODE', { key: 'value' })
      expect(error).toEqual(expect.objectContaining({ message: 'Test error', code: 'TEST_CODE', context: { key: 'value' } }))
    })

    it('handles empty context', () => {
      const error = createStructuredError('Test error', 'TEST_CODE')
      expect(error.context).toEqual({})
    })

    it('is instance of Error', () => {
      const error = createStructuredError('Test error', 'TEST_CODE')
      expect(error).toBeInstanceOf(Error)
    })

    it('has stack trace', () => {
      const error = createStructuredError('Test error', 'TEST_CODE')
      expect(error.stack).toBeDefined()
    })
  })

  describe('createConfigError', () => {
    it('creates config-specific error', () => {
      const error = createConfigError('Invalid config', 'CONFIG_PARSE_ERROR', { file: 'test.json' })
      expect(error).toEqual(
        expect.objectContaining({ message: 'Invalid config', code: 'CONFIG_PARSE_ERROR', context: { file: 'test.json', type: 'config' } })
      )
    })

    it('adds type automatically', () => {
      const error = createConfigError('Invalid config', 'CONFIG_ERROR')
      expect(error.context?.['type']).toBe('config')
    })
  })

  describe('createFsError', () => {
    it('creates filesystem-specific error', () => {
      const error = createFsError('File not found', 'ENOENT', { path: '/test/path' })
      expect(error).toEqual(
        expect.objectContaining({ message: 'File not found', code: 'ENOENT', context: { path: '/test/path', type: 'fs' } })
      )
    })

    it('handles EACCES error', () => {
      const error = createFsError('Permission denied', 'EACCES', { path: '/protected/file' })
      expect(error).toEqual(expect.objectContaining({ code: 'EACCES', context: { path: '/protected/file', type: 'fs' } }))
    })
  })

  describe('createParseError', () => {
    it('creates parse-specific error', () => {
      const error = createParseError('Invalid JSON', 'JSON_PARSE_ERROR', { file: 'config.json', line: 5 })
      expect(error).toEqual(
        expect.objectContaining({
          message: 'Invalid JSON',
          code: 'JSON_PARSE_ERROR',
          context: { file: 'config.json', line: 5, type: 'parse' },
        })
      )
    })

    it('adds type automatically', () => {
      const error = createParseError('Parse failed', 'PARSE_ERROR')
      expect(error.context?.['type']).toBe('parse')
    })
  })

  describe('createValidationError', () => {
    it('creates validation-specific error', () => {
      const error = createValidationError('Field required', 'VALIDATION_ERROR', {
        field: 'name',
        expected: 'string',
      })
      expect(error).toEqual(
        expect.objectContaining({
          message: 'Field required',
          code: 'VALIDATION_ERROR',
          context: { field: 'name', expected: 'string', type: 'validation' },
        })
      )
    })

    it('adds type automatically', () => {
      const error = createValidationError('Validation failed', 'VALIDATION_ERROR')
      expect(error.context?.['type']).toBe('validation')
    })
  })
})
