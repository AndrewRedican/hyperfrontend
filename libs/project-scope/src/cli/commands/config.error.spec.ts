/**
 * Tests for config.ts error handling branches.
 * Uses Jest mocks to ensure error branches are covered.
 */
import type { MockedFunction } from '@hyperfrontend/testing'
import { resolve } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { writeFixtures } from '../../__test-utils__/write-fixtures'
import * as configModule from '../../project/config'
import { configCommand } from './config'

const FIXTURES_DIR = writeFixtures()
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

jest.mock('../../project/config', () => {
  const actual = jest.requireActual<typeof import('../../project/config')>('../../project/config')
  return {
    ...actual,
    parseConfig: jest.fn().mockImplementation(actual.parseConfig),
    detectConfigs: jest.fn().mockImplementation(actual.detectConfigs),
  }
})

const mockParseConfig = configModule.parseConfig as MockedFunction<typeof configModule.parseConfig>
const mockDetectConfigs = configModule.detectConfigs as MockedFunction<typeof configModule.detectConfigs>

describe('configCommand error branches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockParseConfig.mockImplementation(jest.requireActual<typeof import('../../project/config')>('../../project/config').parseConfig)
    mockDetectConfigs.mockImplementation(jest.requireActual<typeof import('../../project/config')>('../../project/config').detectConfigs)
  })

  describe('formatConfigText catch block (L129)', () => {
    it('shows [Unable to read contents] when parseConfig throws in text format', () => {
      mockParseConfig.mockImplementationOnce(() => {
        throw new Error('Cannot read file')
      })

      mockDetectConfigs.mockImplementationOnce((projectPath) => {
        return jest.requireActual<typeof import('../../project/config')>('../../project/config').detectConfigs(projectPath)
      })

      const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })

      expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('    [Unable to read contents]\n') })
    })
  })

  describe('formatConfigJson catch block (L176-177)', () => {
    it('sets error: Unable to parse and contents: null when parseConfig throws in JSON format', () => {
      mockParseConfig.mockImplementationOnce(() => {
        throw new Error('Parse failed')
      })

      mockDetectConfigs.mockImplementationOnce((projectPath) => {
        return jest.requireActual<typeof import('../../project/config')>('../../project/config').detectConfigs(projectPath)
      })

      const result = configCommand({ path: MINIMAL_PROJECT, showContents: true, format: 'json' })

      expect({ exitCode: result.exitCode, configs: JSON.parse(result.output as string) }).toEqual({
        exitCode: 0,
        configs: expect.arrayContaining([expect.objectContaining({ error: 'Unable to parse', contents: null })]),
      })
    })
  })

  describe('configCommand catch block (L230-231)', () => {
    it('returns exit code 1 and error message when detectConfigs throws', () => {
      mockDetectConfigs.mockImplementationOnce(() => {
        throw new Error('Failed to scan directory')
      })

      const result = configCommand({ path: MINIMAL_PROJECT })

      expect(result).toEqual({ exitCode: 1, error: 'Config inspection failed: Failed to scan directory' })
    })

    it('handles non-Error exceptions in configCommand', () => {
      mockDetectConfigs.mockImplementationOnce(() => {
        throw 'String error message'
      })

      const result = configCommand({ path: MINIMAL_PROJECT })

      expect(result).toEqual({ exitCode: 1, error: 'Config inspection failed: String error message' })
    })
  })
})
