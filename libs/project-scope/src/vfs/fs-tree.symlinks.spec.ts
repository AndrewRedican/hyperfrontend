import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createFsTree } from './fs-tree'

describe('vfs/FsTree - symlink security', () => {
  const tempDir = useTempDir({ prefix: 'fstree-symlinks-test-', scope: 'all' })

  beforeAll(() => {
    mkdirSync(join(tempDir.path, 'src'), { recursive: true })
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test' }))
  })

  describe('isSymlink', () => {
    it('detects symlinks using lstat', () => {
      const tree = createFsTree(tempDir.path)
      const targetPath = join(tempDir.path, 'real.txt')
      const linkPath = join(tempDir.path, 'link.txt')

      writeFileSync(targetPath, 'real content')
      symlinkSync(targetPath, linkPath)

      const classified = { 'link.txt': tree.isSymlink('link.txt'), 'real.txt': tree.isSymlink('real.txt') }
      expect(classified).toEqual({ 'link.txt': true, 'real.txt': false })

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('returns false for non-existent paths', () => {
      const tree = createFsTree(tempDir.path)
      expect(tree.isSymlink('non-existent.txt')).toBe(false)
    })

    it('returns false for regular files', () => {
      const tree = createFsTree(tempDir.path)
      expect(tree.isSymlink('package.json')).toBe(false)
    })

    it('returns false for directories', () => {
      const tree = createFsTree(tempDir.path)
      expect(tree.isSymlink('src')).toBe(false)
    })
  })

  describe('symlink validation with followSymlinks: true (default)', () => {
    it('allows reading symlinks that point within root', () => {
      const tree = createFsTree(tempDir.path)
      const targetPath = join(tempDir.path, 'target.txt')
      const linkPath = join(tempDir.path, 'link.txt')

      writeFileSync(targetPath, 'target content')
      symlinkSync(targetPath, linkPath)

      const content = tree.read('link.txt', 'utf-8')
      expect(content).toBe('target content')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('allows reading relative symlinks within root', () => {
      const tree = createFsTree(tempDir.path)
      const targetPath = join(tempDir.path, 'src', 'target.txt')
      const linkPath = join(tempDir.path, 'link.txt')

      writeFileSync(targetPath, 'relative target')
      symlinkSync('./src/target.txt', linkPath)

      const content = tree.read('link.txt', 'utf-8')
      expect(content).toBe('relative target')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('throws when symlink points outside root (absolute)', () => {
      const tree = createFsTree(tempDir.path)
      const linkPath = join(tempDir.path, 'evil-link')

      symlinkSync('/etc/passwd', linkPath)

      expect(() => tree.read('evil-link')).toThrow('Symlink target escapes tree root')

      rmSync(linkPath)
    })

    it('throws when symlink points outside root (relative)', () => {
      const tree = createFsTree(tempDir.path)
      const linkPath = join(tempDir.path, 'evil-relative-link')

      symlinkSync('../../../etc/passwd', linkPath)

      expect(() => tree.read('evil-relative-link')).toThrow('Symlink target escapes tree root')

      rmSync(linkPath)
    })

    it('validates symlinks in nested directories', () => {
      const tree = createFsTree(tempDir.path)
      const nestedDir = join(tempDir.path, 'nested', 'deep')
      const linkPath = join(nestedDir, 'link.txt')

      mkdirSync(nestedDir, { recursive: true })
      symlinkSync('../../../../etc/passwd', linkPath)

      expect(() => tree.read('nested/deep/link.txt')).toThrow('Symlink target escapes tree root')

      rmSync(join(tempDir.path, 'nested'), { recursive: true, force: true })
    })
  })

  describe('symlink validation with followSymlinks: false', () => {
    it('throws when attempting to read any symlink', () => {
      const tree = createFsTree(tempDir.path, { followSymlinks: false })
      const targetPath = join(tempDir.path, 'safe-target.txt')
      const linkPath = join(tempDir.path, 'safe-link.txt')

      writeFileSync(targetPath, 'safe content')
      symlinkSync(targetPath, linkPath)

      expect(() => tree.read('safe-link.txt')).toThrow('Cannot access symlink when followSymlinks is disabled')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('allows reading regular files', () => {
      const tree = createFsTree(tempDir.path, { followSymlinks: false })
      const content = tree.read('package.json', 'utf-8')
      expect(content).toContain('test')
    })

    it('throws when symlink is in buffered change path', () => {
      const tree = createFsTree(tempDir.path, { followSymlinks: false })
      const targetPath = join(tempDir.path, 'existing.txt')
      const linkPath = join(tempDir.path, 'existing-link.txt')

      writeFileSync(targetPath, 'existing')
      symlinkSync(targetPath, linkPath)

      expect(() => tree.write('existing-link.txt', 'updated content')).toThrow('Cannot access symlink when followSymlinks is disabled')

      rmSync(linkPath)
      rmSync(targetPath)
    })
  })

  describe('symlink edge cases', () => {
    it('handles symlink chains within root', () => {
      const tree = createFsTree(tempDir.path)
      const targetPath = join(tempDir.path, 'final-target.txt')
      const link1Path = join(tempDir.path, 'link1.txt')
      const link2Path = join(tempDir.path, 'link2.txt')

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
      const tree = createFsTree(tempDir.path)
      const linkPath = join(tempDir.path, 'src-link')

      rmSync(linkPath, { recursive: true, force: true })

      symlinkSync(join(tempDir.path, 'src'), linkPath, 'dir')

      expect(tree.isSymlink('src-link')).toBe(true)

      rmSync(linkPath, { recursive: true, force: true })
    })

    it('classifies a directory symlink within root as a directory', () => {
      const tree = createFsTree(tempDir.path)
      const linkPath = join(tempDir.path, 'src-link')

      rmSync(linkPath, { recursive: true, force: true })

      symlinkSync(join(tempDir.path, 'src'), linkPath, 'dir')

      expect(tree.isDirectory('src-link')).toBe(true)

      rmSync(linkPath, { recursive: true, force: true })
    })

    it('validates when reading from disk after update', () => {
      const tree = createFsTree(tempDir.path)
      const targetPath = join(tempDir.path, 'update-target.txt')
      const linkPath = join(tempDir.path, 'update-link.txt')

      writeFileSync(targetPath, 'original')
      symlinkSync('/etc/passwd', linkPath)

      tree.write('package.json', '{"name": "modified"}')

      expect(() => tree.read('update-link.txt')).toThrow('Symlink target escapes tree root')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('handles symlink with absolute target within root', () => {
      const tree = createFsTree(tempDir.path)
      const targetPath = join(tempDir.path, 'absolute-target.txt')
      const linkPath = join(tempDir.path, 'absolute-link.txt')

      writeFileSync(targetPath, 'absolute target content')

      symlinkSync(targetPath, linkPath)

      const content = tree.read('absolute-link.txt', 'utf-8')
      expect(content).toBe('absolute target content')

      rmSync(linkPath)
      rmSync(targetPath)
    })

    it('returns null when reading a symlink whose in-root target does not exist', () => {
      const tree = createFsTree(tempDir.path)
      const linkPath = join(tempDir.path, 'broken-symlink.txt')

      symlinkSync('non-existent-target.txt', linkPath)

      const content = tree.read('broken-symlink.txt')
      expect(content).toBeNull()

      rmSync(linkPath)
    })
  })
})
