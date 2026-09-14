import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createFsTree } from './fs-tree'

const TEST_DIR = join(import.meta.dirname, '__test_fixtures_fstree_guards__')
const POISONED = `src/index${'\u0000'}.ts`

describe('vfs/FsTree - path guards', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export const value = 42')
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('NUL byte rejection', () => {
    it('rejects a write to a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).write(POISONED, 'payload')).toThrow('Unsafe path (NUL byte)')
    })

    it('buffers no change for a rejected write', () => {
      const tree = createFsTree(TEST_DIR)

      expect(() => tree.write(POISONED, 'payload')).toThrow()
      expect(tree.listChanges()).toEqual([])
    })

    it('rejects a read of a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).read(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('rejects an existence check on a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).exists(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('rejects a delete of a path carrying a NUL byte', () => {
      expect(() => createFsTree(TEST_DIR).delete(POISONED)).toThrow('Unsafe path (NUL byte)')
    })

    it('names the offending path in the rejection', () => {
      expect(() => createFsTree(TEST_DIR).write(POISONED, 'payload')).toThrow(/Unsafe path \(NUL byte\): src\/index/)
    })
  })
})
