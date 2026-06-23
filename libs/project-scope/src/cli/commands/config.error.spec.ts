/**
 * Tests for config.ts error handling branches.
 * Uses Jest mocks to ensure error branches are covered.
 */
import { resolve } from 'node:path'
import * as configModule from '../../project/config'
import { configCommand } from './config'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

jest.mock('../../project/config', () => {
  const actual = jest.requireActual('../../project/config')
  return {
    ...actual,
    parseConfig: jest.fn().mockImplementation(actual.parseConfig),
    detectConfigs: jest.fn().mockImplementation(actual.detectConfigs),
  }
})

const mockParseConfig = configModule.parseConfig as jest.MockedFunction<typeof configModule.parseConfig>
const mockDetectConfigs = configModule.detectConfigs as jest.MockedFunction<typeof configModule.detectConfigs>

describe('configCommand error branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockParseConfig.mockImplementation(jest.requireActual('../../project/config').parseConfig)
    mockDetectConfigs.mockImplementation(jest.requireActual('../../project/config').detectConfigs)
  })

  describe('formatConfigText catch block (L129)', () => {
    it('shows [Unable to read contents] when parseConfig throws in text format', () => {
      mockParseConfig.mockImplementationOnce(() => {
        throw new Error('Cannot read file')
      })

      mockDetectConfigs.mockImplementationOnce((projectPath) => {
        return jest.requireActual('../../project/config').detectConfigs(projectPath)
      })

      const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })

      expect(result.exitCode).toBe(0)
      expect(result.output).toContain('[Unable to read contents]')
    })
  })

  describe('formatConfigJson catch block (L176-177)', () => {
    it('sets error: Unable to parse and contents: null when parseConfig throws in JSON format', () => {
      mockParseConfig.mockImplementationOnce(() => {
        throw new Error('Parse failed')
      })

      mockDetectConfigs.mockImplementationOnce((projectPath) => {
        return jest.requireActual('../../project/config').detectConfigs(projectPath)
      })

      const result = configCommand({ path: MINIMAL_PROJECT, showContents: true, format: 'json' })

      expect(result.exitCode).toBe(0)
      const parsed = JSON.parse(result.output as string)
      expect(Array.isArray(parsed)).toBe(true)

      const errorConfig = parsed.find((c: Record<string, unknown>) => c['error'] === 'Unable to parse')
      expect(errorConfig).toBeDefined()
      expect(errorConfig['contents']).toBeNull()
    })
  })

  describe('configCommand catch block (L230-231)', () => {
    it('returns exit code 1 and error message when detectConfigs throws', () => {
      mockDetectConfigs.mockImplementationOnce(() => {
        throw new Error('Failed to scan directory')
      })

      const result = configCommand({ path: MINIMAL_PROJECT })

      expect(result.exitCode).toBe(1)
      expect(result.error).toContain('Config inspection failed')
      expect(result.error).toContain('Failed to scan directory')
    })

    it('handles non-Error exceptions in configCommand', () => {
      mockDetectConfigs.mockImplementationOnce(() => {
        throw 'String error message'
      })

      const result = configCommand({ path: MINIMAL_PROJECT })

      expect(result.exitCode).toBe(1)
      expect(result.error).toContain('Config inspection failed')
      expect(result.error).toContain('String error message')
    })
  })
})
