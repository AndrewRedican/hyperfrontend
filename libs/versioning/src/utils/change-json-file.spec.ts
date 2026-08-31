import type { Tree } from '@hyperfrontend/project-scope/vfs'
import { changeJsonFile, DEFAULT_CHANGE_JSON_FILE_OPTIONS } from './change-json-file'

/**
 * Creates a mock Tree for testing.
 *
 * @param files - Initial file contents
 * @returns Mock tree with testing utilities
 */
function createMockTree(files: Record<string, string>): Tree & { _getWrittenFiles: () => Record<string, string> } {
  const writtenFiles: Record<string, string> = {}

  const tree = {
    read: (path: string, encoding?: string) => {
      if (writtenFiles[path]) {
        return encoding ? writtenFiles[path] : Buffer.from(writtenFiles[path])
      }
      const content = files[path]
      if (content === null || content === undefined) return null
      return encoding ? content : Buffer.from(content)
    },
    write: (path: string, content: string | Buffer) => {
      writtenFiles[path] = typeof content === 'string' ? content : content.toString()
    },
    exists: (path: string) => path in files || path in writtenFiles,
    changeFile: (path: string, transform: (content: Buffer) => Buffer) => {
      const content = tree.read(path, undefined)
      if (content === null) {
        throw new Error(`File not found: ${path}`)
      }
      const buffer = typeof content === 'string' ? Buffer.from(content) : (content as Buffer)
      const result = transform(buffer)
      tree.write(path, result)
    },
    root: '/workspace',
    _getWrittenFiles: () => writtenFiles,
  }

  return tree as unknown as Tree & { _getWrittenFiles: () => Record<string, string> }
}

describe('changeJsonFile', () => {
  describe('DEFAULT_CHANGE_JSON_FILE_OPTIONS', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_CHANGE_JSON_FILE_OPTIONS.indent).toBe(2)
      expect(DEFAULT_CHANGE_JSON_FILE_OPTIONS.trailingNewline).toBe(true)
    })
  })

  describe('basic functionality', () => {
    it('transforms JSON file content', () => {
      const tree = createMockTree({
        'package.json': '{"name": "test", "version": "1.0.0"}',
      })

      changeJsonFile<{ name: string; version: string }>(tree, 'package.json', (data) => {
        data.version = '2.0.0'
        return data
      })

      const written = tree._getWrittenFiles()
      const result = JSON.parse(written['package.json'])
      expect(result.version).toBe('2.0.0')
      expect(result.name).toBe('test')
    })

    it('preserves all fields when transforming', () => {
      const tree = createMockTree({
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

      const written = tree._getWrittenFiles()
      const result = JSON.parse(written['package.json'])
      expect(result.name).toBe('test')
      expect(result.version).toBe('2.0.0')
      expect(result.description).toBe('Test package')
      expect(result.main).toBe('index.js')
    })

    it('can add new fields', () => {
      const tree = createMockTree({
        'package.json': '{"name": "test"}',
      })

      changeJsonFile<{ name: string; version?: string }>(tree, 'package.json', (data) => {
        data.version = '1.0.0'
        return data
      })

      const written = tree._getWrittenFiles()
      const result = JSON.parse(written['package.json'])
      expect(result.version).toBe('1.0.0')
    })

    it('can remove fields', () => {
      const tree = createMockTree({
        'package.json': '{"name": "test", "version": "1.0.0", "private": true}',
      })

      changeJsonFile<Record<string, unknown>>(tree, 'package.json', (data) => {
        delete data['private']
        return data
      })

      const written = tree._getWrittenFiles()
      const result = JSON.parse(written['package.json'])
      expect(result['private']).toBeUndefined()
      expect(result.name).toBe('test')
    })
  })

  describe('formatting options', () => {
    it('uses 2-space indentation by default', () => {
      const tree = createMockTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data)

      const written = tree._getWrittenFiles()['package.json']
      expect(written).toContain('  "name"')
    })

    it('adds trailing newline by default', () => {
      const tree = createMockTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data)

      const written = tree._getWrittenFiles()['package.json']
      expect(written.endsWith('\n')).toBe(true)
    })

    it('respects custom indent option', () => {
      const tree = createMockTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data, { indent: 4 })

      const written = tree._getWrittenFiles()['package.json']
      expect(written).toContain('    "name"')
    })

    it('respects trailingNewline: false option', () => {
      const tree = createMockTree({
        'package.json': '{"name":"test"}',
      })

      changeJsonFile(tree, 'package.json', (data) => data, { trailingNewline: false })

      const written = tree._getWrittenFiles()['package.json']
      expect(written.endsWith('\n')).toBe(false)
      expect(written.endsWith('}')).toBe(true)
    })
  })

  describe('error handling', () => {
    it('throws when file does not exist', () => {
      const tree = createMockTree({})

      expect(() => changeJsonFile(tree, 'nonexistent.json', (data) => data)).toThrow('File not found: nonexistent.json')
    })

    it('throws when JSON is invalid', () => {
      const tree = createMockTree({
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

      const tree = createMockTree({
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

      const written = tree._getWrittenFiles()
      const result = JSON.parse(written['package.json'])
      expect(result.dependencies.underscore).toBe('^1.0.0')
      expect(result.dependencies.lodash).toBe('^4.0.0')
    })
  })
})
