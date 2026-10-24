import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { changeJsonFile, DEFAULT_CHANGE_JSON_FILE_OPTIONS } from './change-json-file'

describe('changeJsonFile', () => {
  describe('DEFAULT_CHANGE_JSON_FILE_OPTIONS', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_CHANGE_JSON_FILE_OPTIONS).toEqual({ indent: 2, trailingNewline: true })
    })
  })

  describe('basic functionality', () => {
    it('transforms JSON file content', () => {
      const tree = createMemoryTree({
        'package.json': '{"name": "test", "version": "1.0.0"}',
      })

      changeJsonFile<{ name: string; version: string }>(tree, 'package.json', (data) => {
        data.version = '2.0.0'
        return data
      })

      const result = JSON.parse(tree.read('package.json', 'utf-8') ?? '')
      expect(result).toEqual({ name: 'test', version: '2.0.0' })
    })

    it('preserves all fields when transforming', () => {
      const tree = createMemoryTree({
        'package.json': JSON.stringify({
          name: 'test',
          version: '1.0.0',
          description: 'Test package',
          main: 'index.js',
        }),
      })

      changeJsonFile<{ version: string }>(tree, 'package.json', (data) => {
        data.version = '2.0.0'
        return data
      })

      const result = JSON.parse(tree.read('package.json', 'utf-8') ?? '')
      expect(result).toEqual({ name: 'test', version: '2.0.0', description: 'Test package', main: 'index.js' })
    })

    it('can add new fields', () => {
      const tree = createMemoryTree({
        'package.json': '{"name": "test"}',
      })

      changeJsonFile<{ name: string; version?: string }>(tree, 'package.json', (data) => {
        data.version = '1.0.0'
        return data
      })

      const result = JSON.parse(tree.read('package.json', 'utf-8') ?? '')
      expect(result.version).toBe('1.0.0')
    })

    it('can remove fields', () => {
      const tree = createMemoryTree({
        'package.json': '{"name": "test", "version": "1.0.0", "private": true}',
      })

      changeJsonFile<Record<string, unknown>>(tree, 'package.json', (data) => {
        delete data['private']
        return data
      })

      const result = JSON.parse(tree.read('package.json', 'utf-8') ?? '')
      expect(result).toEqual({ name: 'test', version: '1.0.0' })
    })
  })

  describe('formatting options', () => {
    it('uses 2-space indentation by default', () => {
      const tree = createMemoryTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data)

      const written = tree.read('package.json', 'utf-8') ?? ''
      expect(written).toContain('  "name"')
    })

    it('adds trailing newline by default', () => {
      const tree = createMemoryTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data)

      const written = tree.read('package.json', 'utf-8') ?? ''
      expect(written.endsWith('\n')).toBe(true)
    })

    it('respects custom indent option', () => {
      const tree = createMemoryTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data, { indent: 4 })

      const written = tree.read('package.json', 'utf-8') ?? ''
      expect(written).toContain('    "name"')
    })

    it('respects trailingNewline: false option', () => {
      const tree = createMemoryTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data, { trailingNewline: false })

      const written = tree.read('package.json', 'utf-8') ?? ''
      expect(written).toBe('{\n  "name": "test"\n}')
    })
  })

  describe('error handling', () => {
    it('throws when file does not exist', () => {
      const tree = createMemoryTree({})

      expect(() => changeJsonFile(tree, 'nonexistent.json', (data) => data)).toThrow('File not found: nonexistent.json')
    })

    it('throws when JSON is invalid', () => {
      const tree = createMemoryTree({
        'invalid.json': 'not valid json {{{',
      })

      expect(() => changeJsonFile(tree, 'invalid.json', (data) => data)).toThrow()
    })
  })

  describe('type safety', () => {
    it('works with typed transforms', () => {
      interface PackageJson {
        name: string
        version: string
        dependencies?: Record<string, string>
      }

      const tree = createMemoryTree({
        'package.json': JSON.stringify({
          name: 'test',
          version: '1.0.0',
          dependencies: { lodash: '^4.0.0' },
        }),
      })

      changeJsonFile<PackageJson>(tree, 'package.json', (pkg) => {
        pkg.dependencies = { ...pkg.dependencies, underscore: '^1.0.0' }
        return pkg
      })

      const result = JSON.parse(tree.read('package.json', 'utf-8') ?? '')
      expect(result.dependencies).toEqual({ lodash: '^4.0.0', underscore: '^1.0.0' })
    })
  })
})
