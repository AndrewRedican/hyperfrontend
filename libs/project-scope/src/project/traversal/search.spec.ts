import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTree } from '../../vfs'
import { findFiles, findFilesInTree, findDirectories } from './search'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')

describe('findFiles', () => {
  it('finds files matching a single pattern', () => {
    const results = findFiles(MINIMAL_PROJECT, '*.json', { includeHidden: true })

    expect(results).toContain('package.json')
    expect(results).toContain('tsconfig.json')
  })

  it('finds files matching multiple patterns', () => {
    const results = findFiles(MINIMAL_PROJECT, ['*.json', '**/*.ts'], { includeHidden: true })

    expect(results).toContain('package.json')
    expect(results.some((f) => f.endsWith('.ts'))).toBe(true)
  })

  it('finds files with glob patterns', () => {
    const results = findFiles(MINIMAL_PROJECT, 'src/*.ts', { includeHidden: true })

    expect(results).toContain('src/index.ts')
    expect(results).toContain('src/utils.ts')
  })

  it('respects maxResults option', () => {
    const results = findFiles(MINIMAL_PROJECT, '**/*.ts', {
      includeHidden: true,
      maxResults: 1,
    })

    expect(results.length).toBe(1)
  })

  it('returns absolute paths when absolutePaths option is true', () => {
    const results = findFiles(MINIMAL_PROJECT, '*.json', {
      includeHidden: true,
      absolutePaths: true,
    })

    expect(results.every((f) => f.startsWith('/'))).toBe(true)
    expect(results.some((f) => f.includes(MINIMAL_PROJECT))).toBe(true)
  })

  it('finds files in nested directories', () => {
    const results = findFiles(MONOREPO, '**/*.ts', { includeHidden: true })

    expect(results.some((f) => f.includes('packages/core/src'))).toBe(true)
  })
})

describe('findFilesInTree', () => {
  it('finds files in a virtual file system tree', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const results = findFilesInTree(tree, '*.json', { includeHidden: true })

    expect(results).toContain('package.json')
    expect(results).toContain('tsconfig.json')
  })

  it('finds files with glob patterns in tree', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const results = findFilesInTree(tree, 'src/*.ts', { includeHidden: true })

    expect(results).toContain('src/index.ts')
  })
})

describe('findDirectories', () => {
  it('finds directories matching a pattern', () => {
    const results = findDirectories(MINIMAL_PROJECT, 'src', { includeHidden: true })

    expect(results).toContain('src')
  })

  it('finds nested directories', () => {
    const results = findDirectories(MONOREPO, '**/src', { includeHidden: true })

    expect(results.some((d) => d.includes('packages/core/src'))).toBe(true)
  })

  it('returns absolute paths when absolutePaths option is true', () => {
    const results = findDirectories(MINIMAL_PROJECT, 'src', {
      includeHidden: true,
      absolutePaths: true,
    })

    expect(results.every((d) => d.startsWith('/'))).toBe(true)
  })

  it('respects maxResults option', () => {
    const results = findDirectories(MONOREPO, '**/*', {
      includeHidden: true,
      maxResults: 2,
    })

    expect(results.length).toBe(2)
  })

  it('finds directories with multiple patterns', () => {
    const results = findDirectories(MONOREPO, ['**/src', '**/core'], {
      includeHidden: true,
    })

    expect(results.length).toBeGreaterThan(0)
  })
})

describe('findFilesInTree - edge cases', () => {
  it('respects maxResults option in tree search', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const results = findFilesInTree(tree, '**/*', {
      includeHidden: true,
      maxResults: 1,
    })

    expect(results.length).toBe(1)
  })

  it('finds files with multiple patterns in tree', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const results = findFilesInTree(tree, ['*.json', '*.ts'], {
      includeHidden: true,
    })

    expect(results.some((f) => f.endsWith('.json'))).toBe(true)
  })

  it('returns empty array when no files match', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const results = findFilesInTree(tree, '*.nonexistent', {
      includeHidden: true,
    })

    expect(results).toEqual([])
  })
})

describe('findFiles - edge cases', () => {
  it('returns empty array for non-existent directory', () => {
    const results = findFiles('/non/existent/path', '*.ts')

    expect(results).toEqual([])
  })

  it('returns empty array when no files match', () => {
    const results = findFiles(MINIMAL_PROJECT, '*.nonexistent')

    expect(results).toEqual([])
  })
})

describe('findDirectories - edge cases', () => {
  it('returns empty array for non-existent directory', () => {
    const results = findDirectories('/non/existent/path', '*')

    expect(results).toEqual([])
  })

  it('returns empty array when no directories match', () => {
    const results = findDirectories(MINIMAL_PROJECT, 'nonexistent-dir')

    expect(results).toEqual([])
  })
})
