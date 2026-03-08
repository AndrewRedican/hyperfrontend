import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createTree, createTreeFromDisk } from './factory'

const TEST_DIR = join(__dirname, '__test_fixtures_factory__')

describe('vfs/factory', () => {
  beforeAll(() => {
    // Create test fixtures
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
    writeFileSync(join(TEST_DIR, 'file.txt'), 'content')
  })

  afterAll(() => {
    // Clean up test fixtures
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('createTree', () => {
    it('creates a Tree instance', () => {
      const tree = createTree(TEST_DIR)
      expect(tree).toHaveProperty('root')
      expect(tree).toHaveProperty('read')
      expect(tree).toHaveProperty('write')
    })

    it('sets root correctly', () => {
      const tree = createTree(TEST_DIR)
      expect(tree.root).toBe(TEST_DIR)
    })

    it('throws for non-existent directory', () => {
      expect(() => createTree('/non/existent/path')).toThrow(/does not exist/)
    })

    it('throws for file path', () => {
      expect(() => createTree(join(TEST_DIR, 'file.txt'))).toThrow(/not a directory/)
    })

    it('respects verbose option', () => {
      // Should not throw
      const tree = createTree(TEST_DIR, { verbose: true })
      expect(tree).toHaveProperty('root')
      expect(tree).toHaveProperty('read')
    })

    it('normalizes path with trailing slash', () => {
      const tree = createTree(TEST_DIR + '/')
      expect(tree.root).toBe(TEST_DIR)
    })
  })

  describe('createTreeFromDisk', () => {
    it('creates a Tree instance', () => {
      const tree = createTreeFromDisk(TEST_DIR)
      expect(tree).toHaveProperty('root')
      expect(tree).toHaveProperty('read')
    })

    it('is an alias for createTree', () => {
      const tree1 = createTree(TEST_DIR)
      const tree2 = createTreeFromDisk(TEST_DIR)
      expect(tree1.root).toBe(tree2.root)
    })

    it('respects options', () => {
      const tree = createTreeFromDisk(TEST_DIR, { verbose: true })
      expect(tree).toHaveProperty('root')
      expect(tree).toHaveProperty('read')
    })
  })

  describe('tree functionality', () => {
    it('can read existing files', () => {
      const tree = createTree(TEST_DIR)
      const content = tree.read('file.txt', 'utf-8')
      expect(content).toBe('content')
    })

    it('can write new files', () => {
      const tree = createTree(TEST_DIR)
      tree.write('new.txt', 'new content')
      expect(tree.read('new.txt', 'utf-8')).toBe('new content')
    })

    it('can check existence', () => {
      const tree = createTree(TEST_DIR)
      expect(tree.exists('file.txt')).toBe(true)
      expect(tree.exists('missing.txt')).toBe(false)
    })
  })
})
