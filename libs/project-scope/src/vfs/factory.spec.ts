import { writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { normalizePath } from '../core/path'
import { createTree, createTreeFromDisk } from './factory'

describe('vfs/factory', () => {
  const tempDir = useTempDir({ prefix: 'factory-test-', scope: 'all' })

  beforeAll(() => {
    writeFileSync(join(tempDir.path, 'file.txt'), 'content')
  })

  describe('createTree', () => {
    it('creates a Tree instance', () => {
      const tree = createTree(tempDir.path)
      expect(tree).toEqual(expect.objectContaining({ root: expect.any(String), read: expect.any(Function), write: expect.any(Function) }))
    })

    it('sets root correctly', () => {
      const tree = createTree(tempDir.path)
      expect(tree.root).toBe(normalizePath(tempDir.path))
    })

    it('throws for non-existent directory', () => {
      expect(() => createTree('/non/existent/path')).toThrow(/does not exist/)
    })

    it('throws for file path', () => {
      expect(() => createTree(join(tempDir.path, 'file.txt'))).toThrow(/not a directory/)
    })

    it('respects verbose option', () => {
      const tree = createTree(tempDir.path, { verbose: true })
      expect(tree).toEqual(expect.objectContaining({ root: expect.any(String), read: expect.any(Function) }))
    })

    it('normalizes path with trailing slash', () => {
      const tree = createTree(tempDir.path + sep)
      expect(tree.root).toBe(normalizePath(tempDir.path))
    })
  })

  describe('createTreeFromDisk', () => {
    it('creates a Tree instance', () => {
      const tree = createTreeFromDisk(tempDir.path)
      expect(tree).toEqual(expect.objectContaining({ root: expect.any(String), read: expect.any(Function) }))
    })

    it('is an alias for createTree', () => {
      const tree1 = createTree(tempDir.path)
      const tree2 = createTreeFromDisk(tempDir.path)
      expect(tree1.root).toBe(tree2.root)
    })

    it('respects options', () => {
      const tree = createTreeFromDisk(tempDir.path, { verbose: true })
      expect(tree).toEqual(expect.objectContaining({ root: expect.any(String), read: expect.any(Function) }))
    })
  })

  describe('tree functionality', () => {
    it('can read existing files', () => {
      const tree = createTree(tempDir.path)
      const content = tree.read('file.txt', 'utf-8')
      expect(content).toBe('content')
    })

    it('can write new files', () => {
      const tree = createTree(tempDir.path)
      tree.write('new.txt', 'new content')
      expect(tree.read('new.txt', 'utf-8')).toBe('new content')
    })

    it('reports an existing file as present', () => {
      const tree = createTree(tempDir.path)
      expect(tree.exists('file.txt')).toBe(true)
    })

    it('reports a missing file as absent', () => {
      const tree = createTree(tempDir.path)
      expect(tree.exists('missing.txt')).toBe(false)
    })
  })
})
