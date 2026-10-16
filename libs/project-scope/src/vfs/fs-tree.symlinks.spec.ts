import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createFsTree } from './fs-tree'

const TEST_DIR = join(import.meta.dirname, '__test_fixtures_fstree_symlinks__')

describe('vfs/FsTree - symlink security', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }))
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('isSymlink', () => {
    it('detects symlinks using lstat', () => {
      const tree = createFsTree(TEST_DIR)
      const targetPath = join(TEST_DIR, 'real.txt')
      const linkPath = join(TEST_DIR, 'link.txt')

      writeFileSync(targetPath, 'real content')
      symlinkSync(targetPath, linkPath)

      const classified = { 'link.txt': tree.isSymlink('link.txt'), 'real.txt': tree.isSymlink('real.txt') }
      expect(classified).toEqual({ 'link.txt': true, 'real.txt': false })

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('returns false for non-existent paths', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isSymlink('non-existent.txt')).toBe(false)
    })

    it('returns false for regular files', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isSymlink('package.json')).toBe(false)
    })

    it('returns false for directories', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isSymlink('src')).toBe(false)
    })
  })

  describe('symlink validation with followSymlinks: true (default)', () => {
    it('allows reading symlinks that point within root', () => {
      const tree = createFsTree(TEST_DIR)
      const targetPath = join(TEST_DIR, 'target.txt')
      const linkPath = join(TEST_DIR, 'link.txt')

      writeFileSync(targetPath, 'target content')
      symlinkSync(targetPath, linkPath)

      const content = tree.read('link.txt', 'utf-8')
      expect(content).toBe('target content')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('allows reading relative symlinks within root', () => {
      const tree = createFsTree(TEST_DIR)
      const targetPath = join(TEST_DIR, 'src', 'target.txt')
      const linkPath = join(TEST_DIR, 'link.txt')

      writeFileSync(targetPath, 'relative target')
      symlinkSync('./src/target.txt', linkPath)

      const content = tree.read('link.txt', 'utf-8')
      expect(content).toBe('relative target')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('throws when symlink points outside root (absolute)', () => {
      const tree = createFsTree(TEST_DIR)
      const linkPath = join(TEST_DIR, 'evil-link')

      symlinkSync('/etc/passwd', linkPath)

      expect(() => tree.read('evil-link')).toThrow('Symlink target escapes tree root')

      rmSync(linkPath)
    })

    it('throws when symlink points outside root (relative)', () => {
      const tree = createFsTree(TEST_DIR)
      const linkPath = join(TEST_DIR, 'evil-relative-link')

      symlinkSync('../../../etc/passwd', linkPath)

      expect(() => tree.read('evil-relative-link')).toThrow('Symlink target escapes tree root')

      rmSync(linkPath)
    })

    it('validates symlinks in nested directories', () => {
      const tree = createFsTree(TEST_DIR)
      const nestedDir = join(TEST_DIR, 'nested', 'deep')
      const linkPath = join(nestedDir, 'link.txt')

      mkdirSync(nestedDir, { recursive: true })
      symlinkSync('../../../../etc/passwd', linkPath)

      expect(() => tree.read('nested/deep/link.txt')).toThrow('Symlink target escapes tree root')

      rmSync(join(TEST_DIR, 'nested'), { recursive: true, force: true })
    })
  })

  describe('symlink validation with followSymlinks: false', () => {
    it('throws when attempting to read any symlink', () => {
      const tree = createFsTree(TEST_DIR, { followSymlinks: false })
      const targetPath = join(TEST_DIR, 'safe-target.txt')
      const linkPath = join(TEST_DIR, 'safe-link.txt')

      writeFileSync(targetPath, 'safe content')
      symlinkSync(targetPath, linkPath)

      expect(() => tree.read('safe-link.txt')).toThrow('Cannot access symlink when followSymlinks is disabled')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('allows reading regular files', () => {
      const tree = createFsTree(TEST_DIR, { followSymlinks: false })
      const content = tree.read('package.json', 'utf-8')
      expect(content).toContain('test')
    })

    it('throws when symlink is in buffered change path', () => {
      const tree = createFsTree(TEST_DIR, { followSymlinks: false })
      const targetPath = join(TEST_DIR, 'existing.txt')
      const linkPath = join(TEST_DIR, 'existing-link.txt')

      writeFileSync(targetPath, 'existing')
      symlinkSync(targetPath, linkPath)

      expect(() => tree.write('existing-link.txt', 'updated content')).toThrow('Cannot access symlink when followSymlinks is disabled')

      rmSync(linkPath)
      rmSync(targetPath)
    })
  })

  describe('symlink edge cases', () => {
    it('handles symlink chains within root', () => {
      const tree = createFsTree(TEST_DIR)
      const targetPath = join(TEST_DIR, 'final-target.txt')
      const link1Path = join(TEST_DIR, 'link1.txt')
      const link2Path = join(TEST_DIR, 'link2.txt')

      writeFileSync(targetPath, 'chain content')
      symlinkSync(targetPath, link1Path)
      symlinkSync(link1Path, link2Path)

      const content = tree.read('link2.txt', 'utf-8')
      expect(content).toBe('chain content')

      rmSync(link2Path)
      rmSync(link1Path)
      rmSync(targetPath)
    })

    it('reports a directory symlink within root as a symlink', () => {
      const tree = createFsTree(TEST_DIR)
      const linkPath = join(TEST_DIR, 'src-link')

      rmSync(linkPath, { recursive: true, force: true })

      symlinkSync(join(TEST_DIR, 'src'), linkPath, 'dir')

      expect(tree.isSymlink('src-link')).toBe(true)

      rmSync(linkPath, { recursive: true, force: true })
    })

    it('classifies a directory symlink within root as a directory', () => {
      const tree = createFsTree(TEST_DIR)
      const linkPath = join(TEST_DIR, 'src-link')

      rmSync(linkPath, { recursive: true, force: true })

      symlinkSync(join(TEST_DIR, 'src'), linkPath, 'dir')

      expect(tree.isDirectory('src-link')).toBe(true)

      rmSync(linkPath, { recursive: true, force: true })
    })

    it('validates when reading from disk after update', () => {
      const tree = createFsTree(TEST_DIR)
      const targetPath = join(TEST_DIR, 'update-target.txt')
      const linkPath = join(TEST_DIR, 'update-link.txt')

      writeFileSync(targetPath, 'original')
      symlinkSync('/etc/passwd', linkPath)

      tree.write('package.json', '{"name": "modified"}')

      expect(() => tree.read('update-link.txt')).toThrow('Symlink target escapes tree root')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('handles symlink with absolute target within root', () => {
      const tree = createFsTree(TEST_DIR)
      const targetPath = join(TEST_DIR, 'absolute-target.txt')
      const linkPath = join(TEST_DIR, 'absolute-link.txt')

      writeFileSync(targetPath, 'absolute target content')

      symlinkSync(targetPath, linkPath)

      const content = tree.read('absolute-link.txt', 'utf-8')
      expect(content).toBe('absolute target content')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('returns null when reading a symlink whose in-root target does not exist', () => {
      const tree = createFsTree(TEST_DIR)
      const linkPath = join(TEST_DIR, 'broken-symlink.txt')

      symlinkSync('non-existent-target.txt', linkPath)

      const content = tree.read('broken-symlink.txt')
      expect(content).toBeNull()

      rmSync(linkPath)
    })
  })
})
