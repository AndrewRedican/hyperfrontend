import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspaceManager } from '../testing'
import { exists, isDirectory, readDirectory, readFileContent, readFileIfExists, readJsonFile, readJsonFileIfExists } from './fs'

const manager = createTempWorkspaceManager()

afterAll(() => {
  manager.cleanupAll()
})

describe('readFileContent', () => {
  it('reads file contents', () => {
    const workspace = manager.create({
      files: { 'test.txt': 'hello world' },
    })

    const content = readFileContent(workspace.getPath('test.txt'))

    expect(content).toBe('hello world')
  })

  it('throws for missing file', () => {
    const workspace = manager.create()

    expect(() => readFileContent(workspace.getPath('missing.txt'))).toThrow()
  })
})

describe('readFileIfExists', () => {
  it('returns file contents when file exists', () => {
    const workspace = manager.create({
      files: { 'test.txt': 'hello' },
    })

    const content = readFileIfExists(workspace.getPath('test.txt'))

    expect(content).toBe('hello')
  })

  it('returns null for missing file', () => {
    const workspace = manager.create()

    const content = readFileIfExists(workspace.getPath('missing.txt'))

    expect(content).toBeNull()
  })
})

describe('readJsonFile', () => {
  it('reads and parses JSON file', () => {
    const workspace = manager.create({
      packageJson: { name: 'test', version: '1.0.0' },
    })

    const content = readJsonFile<{ name: string }>(workspace.getPath('package.json'))

    expect(content.name).toBe('test')
  })

  it('throws for missing file', () => {
    const workspace = manager.create()

    expect(() => readJsonFile(workspace.getPath('missing.json'))).toThrow()
  })

  it('returns default when file missing and default provided', () => {
    const workspace = manager.create()

    const content = readJsonFile(workspace.getPath('missing.json'), { default: { fallback: true } })

    expect(content).toEqual({ fallback: true })
  })
})

describe('readJsonFileIfExists', () => {
  it('returns parsed JSON when file exists', () => {
    const workspace = manager.create({
      packageJson: { name: 'test' },
    })

    const content = readJsonFileIfExists<{ name: string }>(workspace.getPath('package.json'))

    expect(content?.name).toBe('test')
  })

  it('returns null for missing file', () => {
    const workspace = manager.create()

    const content = readJsonFileIfExists(workspace.getPath('missing.json'))

    expect(content).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    const workspace = manager.create({
      files: { 'invalid.json': 'not json {{{' },
    })

    const content = readJsonFileIfExists(workspace.getPath('invalid.json'))

    expect(content).toBeNull()
  })
})

describe('exists', () => {
  it('returns true for existing file', () => {
    const workspace = manager.create({
      files: { 'test.txt': 'content' },
    })

    expect(exists(workspace.getPath('test.txt'))).toBe(true)
  })

  it('returns false for missing file', () => {
    const workspace = manager.create()

    expect(exists(workspace.getPath('missing.txt'))).toBe(false)
  })
})

describe('isDirectory', () => {
  it('returns true for directory', () => {
    const workspace = manager.create({
      directories: ['mydir'],
    })

    expect(isDirectory(workspace.getPath('mydir'))).toBe(true)
  })

  it('returns false for file', () => {
    const workspace = manager.create({
      files: { 'myfile.txt': 'content' },
    })

    expect(isDirectory(workspace.getPath('myfile.txt'))).toBe(false)
  })
})

describe('readDirectory', () => {
  it('returns directory contents', () => {
    const workspace = manager.create({
      files: {
        'file1.ts': '',
        'file2.ts': '',
      },
    })

    const entries = readDirectory(workspace.root)

    expect(entries).toContain('file1.ts')
    expect(entries).toContain('file2.ts')
    expect(entries).toContain('src')
  })
})
