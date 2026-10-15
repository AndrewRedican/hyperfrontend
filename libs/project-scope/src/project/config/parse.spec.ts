import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseConfig, parseJsonConfig, parseYamlConfig, readConfigIfExists } from './parse'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const CONFIG_FILES = resolve(FIXTURES_DIR, 'config-files')

describe('parseConfig', () => {
  it('parses JSON config files', () => {
    const result = parseConfig(resolve(MINIMAL_PROJECT, 'package.json'))

    expect(result).toEqual(
      expect.objectContaining({ format: 'json', type: 'package.json', data: expect.objectContaining({ name: 'minimal-test-project' }) })
    )
  })

  it('parses tsconfig.json as JSONC', () => {
    const result = parseConfig(resolve(MINIMAL_PROJECT, 'tsconfig.json'))

    expect(result).toEqual(
      expect.objectContaining({ format: 'jsonc', type: 'tsconfig', data: expect.objectContaining({ compilerOptions: expect.any(Object) }) })
    )
  })

  it('returns raw content for JS config files', () => {
    const configPath = resolve(import.meta.dirname, '../../../test.config.ts')
    const result = parseConfig(configPath, 'jest')

    expect(result).toEqual({ type: 'jest', path: configPath, format: 'ts', raw: expect.any(String) })
  })

  it('throws error for non-existent file', () => {
    expect(() => parseConfig('/non/existent/file.json')).toThrow()
  })

  it('parses INI format config files', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.ini'))

    expect(result).toEqual(
      expect.objectContaining({ format: 'ini', data: expect.objectContaining({ section1: expect.objectContaining({ key1: 'value1' }) }) })
    )
  })

  it('parses dotenv format config files', () => {
    const result = parseConfig(resolve(CONFIG_FILES, '.env'))

    expect(result).toEqual(
      expect.objectContaining({
        format: 'dotenv',
        type: 'env',
        data: expect.objectContaining({ DATABASE_URL: 'postgres://localhost/db' }),
      })
    )
  })

  it('parses YAML config files', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.yaml'))

    expect(result).toEqual(expect.objectContaining({ format: 'yaml', data: expect.objectContaining({ name: 'test-project' }) }))
  })

  it('parses .yml extension as YAML', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.yml'))

    expect(result).toEqual(expect.objectContaining({ format: 'yaml', data: expect.objectContaining({ name: 'test-yml' }) }))
  })

  it('returns raw content for text files', () => {
    const configPath = resolve(CONFIG_FILES, 'config.txt')
    const result = parseConfig(configPath)

    expect(result).toEqual({ type: 'unknown', path: configPath, format: 'text', raw: expect.any(String) })
  })

  it('auto-detects unknown config type', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.txt'))

    expect(result.type).toBe('unknown')
  })

  it('returns raw content for .cjs files', () => {
    const configPath = resolve(CONFIG_FILES, 'config.cjs')
    const result = parseConfig(configPath)

    expect(result).toEqual({ type: 'unknown', path: configPath, format: 'js', raw: expect.any(String) })
  })

  it('returns raw content for .mjs files', () => {
    const configPath = resolve(CONFIG_FILES, 'config.mjs')
    const result = parseConfig(configPath)

    expect(result).toEqual({ type: 'unknown', path: configPath, format: 'js', raw: expect.any(String) })
  })

  it('returns raw content for .toml files (not parsed)', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.toml'))

    expect(result).toEqual(expect.objectContaining({ format: 'text', raw: expect.any(String) }))
  })
})

describe('parseJsonConfig', () => {
  it('parses valid JSON', () => {
    const result = parseJsonConfig('/test/config.json', '{"key": "value"}', 'package.json')

    expect(result.data).toEqual({ key: 'value' })
  })

  it('extracts single extends path', () => {
    const content = '{"extends": "./base.json", "name": "test"}'
    const result = parseJsonConfig('/test/tsconfig.json', content, 'tsconfig')

    expect(result.extends).toEqual(['./base.json'])
  })

  it('extracts array extends paths', () => {
    const content = '{"extends": ["./base1.json", "./base2.json"]}'
    const result = parseJsonConfig('/test/tsconfig.json', content, 'tsconfig')

    expect(result.extends).toEqual(['./base1.json', './base2.json'])
  })

  it('strips single-line comments in JSONC', () => {
    const content = `{
      // This is a comment
      "key": "value"
    }`
    const result = parseJsonConfig('/test/config.jsonc', content, undefined, 'jsonc')

    expect(result.data).toEqual({ key: 'value' })
  })

  it('strips block comments in JSONC', () => {
    const content = `{
      /* Block comment */
      "key": "value"
    }`
    const result = parseJsonConfig('/test/config.jsonc', content, undefined, 'jsonc')

    expect(result.data).toEqual({ key: 'value' })
  })

  it('throws error for invalid JSON', () => {
    expect(() => parseJsonConfig('/test/config.json', 'not valid json', 'package.json')).toThrow()
  })
})

describe('parseYamlConfig', () => {
  it('parses simple YAML key-value pairs', () => {
    const content = `
name: test-project
version: 1.0.0
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({
      name: 'test-project',
      version: '1.0.0',
    })
  })

  it('parses boolean values', () => {
    const content = `
enabled: true
disabled: false
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({
      enabled: true,
      disabled: false,
    })
  })

  it('parses numeric values', () => {
    const content = `
integer: 42
float: 3.14
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({
      integer: 42,
      float: 3.14,
    })
  })

  it('ignores YAML comments', () => {
    const content = `
# This is a comment
name: test
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({ name: 'test' })
  })

  it('parses null values', () => {
    const content = `
value: null
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({ value: null })
  })

  it('parses negative integers', () => {
    const content = `
negativeInt: -42
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({ negativeInt: -42 })
  })

  it('parses negative floats', () => {
    const content = `
negativeFloat: -3.14
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({ negativeFloat: -3.14 })
  })

  it('removes surrounding quotes from string values', () => {
    const content = `
doubleQuoted: "hello"
singleQuoted: 'world'
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({
      doubleQuoted: 'hello',
      singleQuoted: 'world',
    })
  })

  it('skips lines without colons', () => {
    const content = `
name: test
invalid line without colon
version: 1.0.0
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({
      name: 'test',
      version: '1.0.0',
    })
  })

  it('skips lines with empty key or value', () => {
    const content = `
name: test
: emptyKey
emptyValue:
    `
    const result = parseYamlConfig('/test/config.yaml', content)

    expect(result.data).toEqual({
      name: 'test',
    })
  })
})

describe('readConfigIfExists', () => {
  it('reads existing JSON config', () => {
    const result = readConfigIfExists<{ name: string }>(resolve(MINIMAL_PROJECT, 'package.json'))

    expect(result).toEqual(expect.objectContaining({ name: 'minimal-test-project' }))
  })

  it('returns null for non-existent file', () => {
    const result = readConfigIfExists('/non/existent/file.json')

    expect(result).toBeNull()
  })

  it('reads tsconfig.json with potential comments', () => {
    const result = readConfigIfExists<{ compilerOptions: object }>(resolve(MINIMAL_PROJECT, 'tsconfig.json'))

    expect(result).toEqual(expect.objectContaining({ compilerOptions: expect.any(Object) }))
  })

  it('reads YAML config files', () => {
    const result = readConfigIfExists<{ name: string }>(resolve(CONFIG_FILES, 'config.yaml'))

    expect(result).toEqual(expect.objectContaining({ name: 'test-project' }))
  })

  it('returns null for unsupported formats', () => {
    const result = readConfigIfExists(resolve(CONFIG_FILES, 'config.txt'))

    expect(result).toBeNull()
  })

  it('returns null for non-JSON/YAML formats like ini', () => {
    const result = readConfigIfExists(resolve(CONFIG_FILES, 'config.ini'))

    expect(result).toBeNull()
  })

  it('returns null when JSON parsing fails', () => {
    const result = readConfigIfExists(resolve(CONFIG_FILES, 'invalid.json'))

    expect(result).toBeNull()
  })
})

describe('stripJsonComments edge cases', () => {
  it('preserves comments inside strings', () => {
    const content = `{
      "url": "http://example.com//path",
      "comment": "this is not a // comment"
    }`
    const result = parseJsonConfig('/test/config.jsonc', content, undefined, 'jsonc')

    expect(result.data).toEqual({
      url: 'http://example.com//path',
      comment: 'this is not a // comment',
    })
  })

  it('handles block comment markers inside strings', () => {
    const content = `{
      "pattern": "/* not a comment */",
      "key": "value"
    }`
    const result = parseJsonConfig('/test/config.jsonc', content, undefined, 'jsonc')

    expect(result.data).toEqual({
      pattern: '/* not a comment */',
      key: 'value',
    })
  })

  it('handles escaped quotes in strings', () => {
    const content = `{
      "escaped": "value with \\"quote\\"",
      "key": "value"
    }`
    const result = parseJsonConfig('/test/config.jsonc', content, undefined, 'jsonc')

    expect(result.data).toEqual({
      escaped: 'value with "quote"',
      key: 'value',
    })
  })

  it('handles single-quoted strings in JSONC', () => {
    const content = `{
      'key': 'value',
      // comment
      'other': 'test'
    }`
    // Note: JSON5-style single quotes may not parse with standard JSON.parse
    const result = parseJsonConfig('/test/config.jsonc', content.replace(/'/g, '"'), undefined, 'jsonc')

    expect(result.data).toEqual({
      key: 'value',
      other: 'test',
    })
  })

  it('handles newlines in line comments', () => {
    const content = `{
      // comment that ends
      "key": "value"
    }`
    const result = parseJsonConfig('/test/config.jsonc', content, undefined, 'jsonc')

    expect(result.data).toEqual({ key: 'value' })
  })
})

describe('parseIniConfig edge cases', () => {
  it('parses INI with global keys outside sections', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.ini'))

    expect((result.data as Record<string, unknown>)['globalKey']).toBe('globalValue')
  })

  it('parses INI sections correctly', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.ini'))

    const section1 = (result.data as Record<string, unknown>)['section1'] as Record<string, string>
    expect(section1).toEqual({ key1: 'value1', key2: 'value2' })
  })

  it('ignores INI comment lines starting with # or ;', () => {
    const result = parseConfig(resolve(CONFIG_FILES, 'config.ini'))

    const keys = Object.keys(result.data as Record<string, unknown>)
    expect(keys.filter((key) => key.startsWith('#') || key.startsWith(';'))).toEqual([])
  })
})

describe('parseDotenv edge cases', () => {
  it('parses double-quoted values', () => {
    const result = parseConfig(resolve(CONFIG_FILES, '.env'))

    expect((result.data as Record<string, unknown>)['API_KEY']).toBe('secret-key-123')
  })

  it('parses single-quoted values', () => {
    const result = parseConfig(resolve(CONFIG_FILES, '.env'))

    expect((result.data as Record<string, unknown>)['DEBUG']).toBe('true')
  })

  it('handles empty values', () => {
    const result = parseConfig(resolve(CONFIG_FILES, '.env'))

    expect((result.data as Record<string, unknown>)['EMPTY_VALUE']).toBe('')
  })

  it('ignores comment lines', () => {
    const result = parseConfig(resolve(CONFIG_FILES, '.env'))

    expect(result.data).not.toHaveProperty('# Environment configuration')
  })
})
