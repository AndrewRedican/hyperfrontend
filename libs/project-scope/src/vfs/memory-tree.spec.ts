import { existsSync } from 'node:fs'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { resolvePath } from '../core/path'
import { commitChanges } from './commit'
import { createMemoryStore, createMemoryTree } from './memory-tree'

const SEED = {
  'package.json': '{"name":"workspace"}',
  'packages/app/package.json': Buffer.from('{"name":"app"}'),
  'packages/app/src/index.ts': 'export {}\n',
}

describe('createMemoryTree', () => {
  it('reads a starting file as text', () => {
    expect(createMemoryTree(SEED).read('packages/app/package.json', 'utf-8')).toBe('{"name":"app"}')
  })

  it('reads a starting file as bytes', () => {
    expect(createMemoryTree(SEED).read('package.json')).toEqual(Buffer.from('{"name":"workspace"}'))
  })

  it('reads a missing file as null', () => {
    expect(createMemoryTree(SEED).read('missing.json')).toBeNull()
  })

  it('reports starting files as files and the directories above them as directories', () => {
    const tree = createMemoryTree(SEED)
    expect({
      file: tree.isFile('packages/app/package.json'),
      directory: tree.isDirectory('packages/app'),
      fileAsDirectory: tree.isDirectory('package.json'),
    }).toEqual({
      file: true,
      directory: true,
      fileAsDirectory: false,
    })
  })

  it('reports implied directories as existing', () => {
    expect(createMemoryTree(SEED).exists('packages')).toBe(true)
  })

  it('reports its root as a directory even with no files', () => {
    expect(createMemoryTree().isDirectory('.')).toBe(true)
  })

  it('lists the entries of a directory, once each and sorted', () => {
    expect(createMemoryTree(SEED).children('packages/app')).toEqual(['package.json', 'src'])
  })

  it('lists the entries of its root', () => {
    expect(createMemoryTree(SEED).children('.')).toEqual(['package.json', 'packages'])
  })

  it('reports no changes for its starting files', () => {
    expect(createMemoryTree(SEED).listChanges()).toEqual([])
  })

  it('reports a write over a starting file as an update carrying the original', () => {
    const tree = createMemoryTree(SEED)
    tree.write('package.json', '{"name":"renamed"}')
    expect(tree.listChanges()).toEqual([
      expect.objectContaining({ path: 'package.json', type: 'UPDATE', originalContent: Buffer.from('{"name":"workspace"}') }),
    ])
  })

  it('reports a new file as a create', () => {
    const tree = createMemoryTree(SEED)
    tree.write('README.md', '# app\n')
    expect(tree.listChanges()).toEqual([expect.objectContaining({ path: 'README.md', type: 'CREATE' })])
  })

  it('reports a deleted starting file as a delete and stops reading it', () => {
    const tree = createMemoryTree(SEED)
    tree.delete('packages/app/src/index.ts')
    expect({ read: tree.read('packages/app/src/index.ts'), changes: tree.listChanges().map(({ path, type }) => ({ path, type })) }).toEqual(
      {
        read: null,
        changes: [{ path: 'packages/app/src/index.ts', type: 'DELETE' }],
      }
    )
  })

  it('renames a starting file', () => {
    const tree = createMemoryTree(SEED)
    tree.rename('package.json', 'package.old.json')
    expect({ moved: tree.read('package.old.json', 'utf-8'), gone: tree.exists('package.json') }).toEqual({
      moved: '{"name":"workspace"}',
      gone: false,
    })
  })

  it('reports its root resolved', () => {
    expect(createMemoryTree({}, { root: '/repo' }).root).toBe(resolvePath('/repo'))
  })

  it('reads a starting file keyed by an absolute path under the root', () => {
    const tree = createMemoryTree({ [resolvePath('/repo/package.json')]: '{}' }, { root: '/repo' })
    expect(tree.read('package.json', 'utf-8')).toBe('{}')
  })

  it('reads a file through an absolute path under the root', () => {
    const tree = createMemoryTree(SEED, { root: '/repo' })
    expect(tree.read(resolvePath('/repo/package.json'), 'utf-8')).toBe('{"name":"workspace"}')
  })

  it('refuses a path that escapes the root', () => {
    expect(() => createMemoryTree(SEED).read('../outside.json')).toThrow('Path escapes tree root')
  })

  it('reports no symbolic links', () => {
    expect(createMemoryTree(SEED).isSymlink('package.json')).toBe(false)
  })
})

describe('commitChanges on a memory tree', () => {
  const ROOT = resolvePath('/hf-memory-tree-never-on-disk')

  it('makes the committed content the new base layer', () => {
    const tree = createMemoryTree(SEED, { root: ROOT })
    tree.write('package.json', '{"name":"committed"}')
    commitChanges(tree)
    expect({ read: tree.read('package.json', 'utf-8'), changes: tree.listChanges() }).toEqual({ read: '{"name":"committed"}', changes: [] })
  })

  it('writes nothing to disk', () => {
    const tree = createMemoryTree({}, { root: ROOT })
    tree.write('created.txt', 'x')
    commitChanges(tree)
    expect(existsSync(ROOT)).toBe(false)
  })

  it('counts the changes it applied', () => {
    const tree = createMemoryTree(SEED, { root: ROOT })
    tree.write('README.md', '#')
    tree.write('package.json', '{}')
    tree.delete('packages/app/src/index.ts')
    const { created, updated, deleted } = commitChanges(tree)
    expect({ created, updated, deleted }).toEqual({ created: 1, updated: 1, deleted: 1 })
  })

  it('removes a committed directory together with everything under it', () => {
    const tree = createMemoryTree(SEED, { root: ROOT })
    tree.delete('packages')
    commitChanges(tree)
    expect({ app: tree.exists('packages/app/package.json'), packages: tree.exists('packages'), kept: tree.exists('package.json') }).toEqual(
      {
        app: false,
        packages: false,
        kept: true,
      }
    )
  })
})

describe('createMemoryStore', () => {
  it('refuses to read a symbolic link, since it holds none', () => {
    expect(() => createMemoryStore('/workspace', createMap()).readlink('/workspace/link')).toThrow('A memory tree holds no symbolic links')
  })
})
