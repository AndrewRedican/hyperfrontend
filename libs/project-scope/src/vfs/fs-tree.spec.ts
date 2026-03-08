import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createFsTree } from './fs-tree'
import { Mode } from './types'

const TEST_DIR = join(__dirname, '__test_fixtures_fstree__')

describe('vfs/FsTree', () => {
  beforeAll(() => {
    // Create test fixtures
    mkdirSync(TEST_DIR, { recursive: true })
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
    mkdirSync(join(TEST_DIR, 'lib'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }))
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export const hello = "world"')
    writeFileSync(join(TEST_DIR, 'src', 'utils.ts'), 'export function add(a: number, b: number) { return a + b }')
    writeFileSync(join(TEST_DIR, 'lib', 'helper.js'), 'module.exports = {}')
  })

  afterAll(() => {
    // Clean up test fixtures
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('constructor', () => {
    it('creates tree with root path', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.root).toBe(TEST_DIR)
    })

    it('normalizes root path', () => {
      const tree = createFsTree(TEST_DIR + '/')
      expect(tree.root).toBe(TEST_DIR)
    })
  })

  describe('factory function', () => {
    it('createFsTree returns object with Tree interface', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree).toHaveProperty('root')
      expect(tree).toHaveProperty('read')
      expect(tree).toHaveProperty('write')
      expect(tree).toHaveProperty('exists')
      expect(tree).toHaveProperty('delete')
      expect(tree).toHaveProperty('rename')
      expect(tree).toHaveProperty('isFile')
      expect(tree).toHaveProperty('isDirectory')
      expect(tree).toHaveProperty('isSymlink')
      expect(tree).toHaveProperty('children')
      expect(tree).toHaveProperty('listChanges')
      expect(tree).toHaveProperty('changePermissions')
      expect(tree).toHaveProperty('changeFile')
      expect(tree).toHaveProperty('clearChanges')
    })

    it('returns plain object, not class instance', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.constructor.name).not.toBe('FsTree')
      expect(tree instanceof Object).toBe(true)
    })

    it('does not expose internal state', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree).not.toHaveProperty('_root')
      expect(tree).not.toHaveProperty('_changes')
      expect(tree).not.toHaveProperty('_isVerbose')
      expect(tree).not.toHaveProperty('_followSymlinks')
      expect(tree).not.toHaveProperty('_changesLog')
      expect(tree).not.toHaveProperty('_clearChanges')
      expect(tree).not.toHaveProperty('_getChangesLog')
    })
  })

  describe('read', () => {
    it('reads file from disk as Buffer', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('package.json')
      expect(Buffer.isBuffer(content)).toBe(true)
      expect(content?.toString()).toContain('test')
    })

    it('reads file from disk as string', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('package.json', 'utf-8')
      expect(typeof content).toBe('string')
      expect(content).toContain('test')
    })

    it('reads file in subdirectory', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('src/index.ts', 'utf-8')
      expect(content).toContain('hello')
    })

    it('returns null for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('non-existent.txt')
      expect(content).toBeNull()
    })

    it('reads file using absolute path within root', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read(join(TEST_DIR, 'package.json'), 'utf-8')
      expect(content).toContain('test')
    })

    it('returns null for directory', () => {
      const tree = createFsTree(TEST_DIR)
      const content = tree.read('src')
      expect(content).toBeNull()
    })

    it('reads buffered content after write', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'buffered content')
      const content = tree.read('new-file.txt', 'utf-8')
      expect(content).toBe('buffered content')
    })

    it('returns null after delete', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      const content = tree.read('package.json')
      expect(content).toBeNull()
    })
  })

  describe('write', () => {
    it('buffers new file write', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'new content')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('CREATE')
      expect(changes[0].path).toBe('new-file.txt')
    })

    it('buffers file update', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('package.json', '{"updated": true}')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('UPDATE')
      expect(changes[0].originalContent).toBeDefined()
    })

    it('creates nested directories in changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('deep/nested/path/file.txt', 'content')
      expect(tree.exists('deep/nested/path/file.txt')).toBe(true)
    })

    it('throws with ExclusiveCreate mode for existing file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.write('package.json', 'content', { mode: Mode.ExclusiveCreate })).toThrow(/already exists/)
    })

    it('skips write with SkipIfExists mode', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('package.json', 'new content', { mode: Mode.SkipIfExists })
      const changes = tree.listChanges()
      expect(changes).toHaveLength(0)
    })

    it('stores permissions when provided', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('script.sh', '#!/bin/bash', { permissions: 0o755 })
      const changes = tree.listChanges()
      expect(changes[0].mode).toBe(0o755)
    })

    it('handles Buffer content', () => {
      const tree = createFsTree(TEST_DIR)
      const buffer = Buffer.from('binary content')
      tree.write('binary.bin', buffer)
      const content = tree.read('binary.bin')
      expect(content).toEqual(buffer)
    })
  })

  describe('exists', () => {
    it('returns true for existing file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.exists('package.json')).toBe(true)
    })

    it('returns true for existing directory', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.exists('src')).toBe(true)
    })

    it('returns false for non-existent path', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.exists('non-existent')).toBe(false)
    })

    it('returns true for buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'content')
      expect(tree.exists('new-file.txt')).toBe(true)
    })

    it('returns false for deleted file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      expect(tree.exists('package.json')).toBe(false)
    })

    it('returns true for implied directory from buffered files', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-dir/file.txt', 'content')
      expect(tree.exists('new-dir')).toBe(true)
    })
  })

  describe('delete', () => {
    it('buffers file deletion', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0].type).toBe('DELETE')
    })

    it('removes newly created file from changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('temp.txt', 'content')
      tree.delete('temp.txt')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(0)
    })

    it('no-op for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('non-existent.txt')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(0)
    })

    it('stores original content', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      const changes = tree.listChanges()
      expect(changes[0].originalContent).toBeDefined()
      expect(changes[0].originalContent?.toString()).toContain('test')
    })
  })

  describe('rename', () => {
    it('renames file via write and delete', () => {
      const tree = createFsTree(TEST_DIR)
      tree.rename('package.json', 'package-backup.json')
      const changes = tree.listChanges()
      expect(changes).toHaveLength(2)
      expect(changes.find((c) => c.type === 'DELETE')?.path).toBe('package.json')
      expect(changes.find((c) => c.type === 'CREATE')?.path).toBe('package-backup.json')
    })

    it('throws for non-existent source', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.rename('missing.txt', 'other.txt')).toThrow(/Source file not found/)
    })

    it('renames buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('temp.txt', 'content')
      tree.rename('temp.txt', 'renamed.txt')
      expect(tree.exists('temp.txt')).toBe(false)
      expect(tree.exists('renamed.txt')).toBe(true)
    })
  })

  describe('isFile', () => {
    it('returns true for file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isFile('package.json')).toBe(true)
    })

    it('returns false for directory', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isFile('src')).toBe(false)
    })

    it('returns true for buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-file.txt', 'content')
      expect(tree.isFile('new-file.txt')).toBe(true)
    })

    it('returns false for deleted file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('package.json')
      expect(tree.isFile('package.json')).toBe(false)
    })
  })

  describe('isDirectory', () => {
    it('returns true for directory', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isDirectory('src')).toBe(true)
    })

    it('returns false for file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.isDirectory('package.json')).toBe(false)
    })

    it('returns true for implied directory', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-dir/file.txt', 'content')
      expect(tree.isDirectory('new-dir')).toBe(true)
    })
  })

  describe('children', () => {
    it('lists directory children from disk', () => {
      const tree = createFsTree(TEST_DIR)
      const children = tree.children('src')
      expect(children).toContain('index.ts')
      expect(children).toContain('utils.ts')
    })

    it('returns sorted children', () => {
      const tree = createFsTree(TEST_DIR)
      const children = tree.children('src')
      expect(children).toEqual([...children].sort())
    })

    it('includes buffered files', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('src/new-file.ts', 'content')
      const children = tree.children('src')
      expect(children).toContain('new-file.ts')
    })

    it('excludes deleted files', () => {
      const tree = createFsTree(TEST_DIR)
      tree.delete('src/index.ts')
      const children = tree.children('src')
      expect(children).not.toContain('index.ts')
    })

    it('handles root directory', () => {
      const tree = createFsTree(TEST_DIR)
      const children = tree.children('.')
      expect(children).toContain('package.json')
      expect(children).toContain('src')
    })

    it('includes implied nested directories', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new-top/nested/file.txt', 'content')
      const children = tree.children('.')
      expect(children).toContain('new-top')
    })
  })

  describe('listChanges', () => {
    it('returns empty array initially', () => {
      const tree = createFsTree(TEST_DIR)
      expect(tree.listChanges()).toEqual([])
    })

    it('returns sorted changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('z-file.txt', 'z')
      tree.write('a-file.txt', 'a')
      const changes = tree.listChanges()
      expect(changes[0].path).toBe('a-file.txt')
      expect(changes[1].path).toBe('z-file.txt')
    })

    it('includes all change types', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('new.txt', 'new')
      tree.write('package.json', 'updated')
      tree.delete('src/utils.ts')
      const changes = tree.listChanges()
      expect(changes.map((c) => c.type).sort()).toEqual(['CREATE', 'DELETE', 'UPDATE'])
    })
  })

  describe('changePermissions', () => {
    it('sets permissions for existing file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.changePermissions('package.json', 0o755)
      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0].mode).toBe(0o755)
    })

    it('throws for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.changePermissions('missing.txt', 0o755)).toThrow(/File not found/)
    })

    it('updates permissions on buffered file', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('script.sh', '#!/bin/bash')
      tree.changePermissions('script.sh', 0o755)
      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0].mode).toBe(0o755)
    })
  })

  describe('changeFile', () => {
    it('transforms file content', () => {
      const tree = createFsTree(TEST_DIR)
      tree.changeFile('package.json', (content) => {
        const json = JSON.parse(content.toString())
        json.modified = true
        return Buffer.from(JSON.stringify(json))
      })
      const content = tree.read('package.json', 'utf-8')
      expect(content).toContain('modified')
    })

    it('throws for non-existent file', () => {
      const tree = createFsTree(TEST_DIR)
      expect(() => tree.changeFile('missing.txt', (c) => c)).toThrow(/File not found/)
    })
  })

  describe('clearChanges', () => {
    it('clears all buffered changes', () => {
      const tree = createFsTree(TEST_DIR)
      tree.write('file1.txt', 'a')
      tree.write('file2.txt', 'b')
      tree.clearChanges()
      expect(tree.listChanges()).toEqual([])
    })
  })

  describe('security: path traversal prevention', () => {
    describe('read operations', () => {
      it('throws error when path traverses outside root with ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('../../../etc/passwd')).toThrow('Path escapes tree root')
      })

      it('throws error when absolute path is outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('/etc/passwd')).toThrow('Path escapes tree root')
      })

      it('prevents nested path traversal attempts', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('src/../../../../../../proc/self/environ')).toThrow('Path escapes tree root')
      })

      it('allows reading root directory itself', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.children('.')).not.toThrow()
      })

      it('allows reading files within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('package.json')).not.toThrow()
        expect(() => tree.read('src/index.ts')).not.toThrow()
      })
    })

    describe('write operations', () => {
      it('throws error when writing outside root with ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write('../../../tmp/malicious.txt', 'bad content')).toThrow('Path escapes tree root')
      })

      it('throws error when writing to absolute path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write('/tmp/malicious.txt', 'bad content')).toThrow('Path escapes tree root')
      })

      it('prevents nested path traversal in write', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write('src/../../../../../../tmp/bad.txt', 'content')).toThrow('Path escapes tree root')
      })

      it('allows writing files within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.write('new-file.txt', 'content')).not.toThrow()
        expect(() => tree.write('src/new.ts', 'content')).not.toThrow()
      })
    })

    describe('delete operations', () => {
      it('throws error when deleting outside root with ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.delete('../../../tmp/important.txt')).toThrow('Path escapes tree root')
      })

      it('throws error when deleting absolute path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.delete('/etc/important')).toThrow('Path escapes tree root')
      })

      it('allows deleting files within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.delete('package.json')).not.toThrow()
      })
    })

    describe('directory operations', () => {
      it('throws error when listing children outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.children('../../../etc')).toThrow('Path escapes tree root')
      })

      it('throws error when checking isDirectory outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.isDirectory('../../../etc')).toThrow('Path escapes tree root')
      })

      it('throws error when checking isFile outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.isFile('../../../etc/passwd')).toThrow('Path escapes tree root')
      })

      it('allows directory operations within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.children('src')).not.toThrow()
        expect(() => tree.isDirectory('src')).not.toThrow()
        expect(() => tree.isFile('package.json')).not.toThrow()
      })
    })

    describe('other file operations', () => {
      it('throws error when renaming to path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.rename('package.json', '../../../tmp/moved.json')).toThrow('Path escapes tree root')
      })

      it('throws error when renaming from path outside root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.rename('../../../etc/passwd', 'copied.txt')).toThrow('Path escapes tree root')
      })

      it('allows rename operations within root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.rename('package.json', 'package-renamed.json')).not.toThrow()
      })
    })

    describe('edge cases', () => {
      it('handles multiple consecutive ../ segments', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('../../../../../../etc/passwd')).toThrow('Path escapes tree root')
      })

      it('handles ../ at the end of path', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('src/../..')).toThrow('Path escapes tree root')
      })

      it('handles mixed / and ../', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.read('src/nested/../../..')).toThrow('Path escapes tree root')
      })

      it('allows accessing root with .', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.exists('.')).not.toThrow()
      })

      it('allows accessing root with empty string', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.exists('')).not.toThrow()
      })
    })
  })

  describe('symlink security', () => {
    describe('isSymlink', () => {
      it('detects symlinks using lstat', () => {
        const tree = createFsTree(TEST_DIR)
        const targetPath = join(TEST_DIR, 'real.txt')
        const linkPath = join(TEST_DIR, 'link.txt')

        writeFileSync(targetPath, 'real content')
        symlinkSync(targetPath, linkPath)

        expect(tree.isSymlink('link.txt')).toBe(true)
        expect(tree.isSymlink('real.txt')).toBe(false)

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

        // Create symlink to /etc/passwd (or any path outside root)
        symlinkSync('/etc/passwd', linkPath)

        expect(() => tree.read('evil-link')).toThrow('Symlink target escapes tree root')

        rmSync(linkPath)
      })

      it('throws when symlink points outside root (relative)', () => {
        const tree = createFsTree(TEST_DIR)
        const linkPath = join(TEST_DIR, 'evil-relative-link')

        // Create symlink that escapes via ../
        symlinkSync('../../../etc/passwd', linkPath)
        console.log('Created symlink:', linkPath, '-> ../../../etc/passwd')

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

        // Try to update the symlink
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

      it('allows symlinks to directories within root', () => {
        const tree = createFsTree(TEST_DIR)
        const linkPath = join(TEST_DIR, 'src-link')

        // Remove if exists from previous failed run
        rmSync(linkPath, { recursive: true, force: true })

        symlinkSync(join(TEST_DIR, 'src'), linkPath, 'dir')

        expect(tree.isSymlink('src-link')).toBe(true)
        // Reading a directory via symlink should still work for directory checks
        expect(tree.isDirectory('src-link')).toBe(true)

        rmSync(linkPath, { recursive: true, force: true })
      })

      it('validates when reading from disk after update', () => {
        const tree = createFsTree(TEST_DIR)
        const targetPath = join(TEST_DIR, 'update-target.txt')
        const linkPath = join(TEST_DIR, 'update-link.txt')

        writeFileSync(targetPath, 'original')
        symlinkSync('/etc/passwd', linkPath)

        // First write to buffer
        tree.write('package.json', '{"name": "modified"}')

        // Then try to read the evil symlink - should still validate
        expect(() => tree.read('update-link.txt')).toThrow('Symlink target escapes tree root')

        rmSync(linkPath)
        rmSync(targetPath)
      })

      it('handles symlink with absolute target within root', () => {
        const tree = createFsTree(TEST_DIR)
        const targetPath = join(TEST_DIR, 'absolute-target.txt')
        const linkPath = join(TEST_DIR, 'absolute-link.txt')

        // Create target file
        writeFileSync(targetPath, 'absolute target content')

        // Create symlink with absolute path pointing within root
        symlinkSync(targetPath, linkPath)

        // Should be able to read it
        const content = tree.read('absolute-link.txt', 'utf-8')
        expect(content).toBe('absolute target content')

        rmSync(linkPath)
        rmSync(targetPath)
      })

      it('throws generic error when symlink validation fails unexpectedly', () => {
        const tree = createFsTree(TEST_DIR)
        const linkPath = join(TEST_DIR, 'broken-symlink.txt')

        // Create a symlink to a non-existent target (broken symlink)
        // This will cause readlinkSync to succeed but the target resolution to potentially fail
        symlinkSync('non-existent-target.txt', linkPath)

        // The symlink exists but points to nothing - read should return null
        // because the file doesn't exist on disk
        const content = tree.read('broken-symlink.txt')
        expect(content).toBeNull()

        rmSync(linkPath)
      })
    })
  })

  describe('additional edge case coverage', () => {
    describe('read after delete', () => {
      it('returns null for file marked as deleted in buffer', () => {
        const tree = createFsTree(TEST_DIR)

        // Verify file exists initially
        expect(tree.exists('package.json')).toBe(true)

        // Delete the file (buffered)
        tree.delete('package.json')

        // Read should return null because file is marked DELETE in buffer
        const content = tree.read('package.json')
        expect(content).toBeNull()
      })

      it('returns null for file deleted then read with encoding', () => {
        const tree = createFsTree(TEST_DIR)
        tree.delete('package.json')
        const content = tree.read('package.json', 'utf-8')
        expect(content).toBeNull()
      })
    })

    describe('reading directory path', () => {
      it('returns null when reading a directory path', () => {
        const tree = createFsTree(TEST_DIR)
        // src is a directory, not a file
        const content = tree.read('src')
        expect(content).toBeNull()
      })
    })

    describe('delete non-existent file variations', () => {
      it('is no-op for file that never existed on disk', () => {
        const tree = createFsTree(TEST_DIR)
        // File that doesn't exist
        tree.delete('completely-nonexistent-file-12345.txt')
        const changes = tree.listChanges()
        expect(changes).toHaveLength(0)
      })
    })

    describe('rename with missing source variations', () => {
      it('throws when source file does not exist on disk', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => {
          tree.rename('nonexistent-source-54321.txt', 'destination.txt')
        }).toThrow('Source file not found')
      })

      it('throws when source was deleted in buffer', () => {
        const tree = createFsTree(TEST_DIR)
        tree.delete('package.json')
        expect(() => {
          tree.rename('package.json', 'backup.json')
        }).toThrow('Source file not found')
      })
    })

    describe('path escape with root-equal paths', () => {
      it('allows access to root directory itself', () => {
        const tree = createFsTree(TEST_DIR)
        expect(tree.exists('.')).toBe(true)
        expect(tree.isDirectory('.')).toBe(true)
      })

      it('throws when normalized path equals parent of root', () => {
        const tree = createFsTree(TEST_DIR)
        expect(() => tree.exists('..')).toThrow('Path escapes tree root')
      })
    })
  })
})
