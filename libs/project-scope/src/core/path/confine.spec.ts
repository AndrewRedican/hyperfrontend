import { mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { isWithinRoot } from './confine'

describe('core/path/confine', () => {
  const root = useTempDir({ prefix: 'confine-root-', scope: 'all' })
  const outside = useTempDir({ prefix: 'confine-outside-', scope: 'all' })

  beforeAll(() => {
    mkdirSync(join(root.path, 'sub'), { recursive: true })
    writeFileSync(join(root.path, 'sub', 'file.ts'), 'export const a = 1')
    writeFileSync(join(outside.path, 'secret.txt'), 'secret')
    symlinkSync(outside.path, join(root.path, 'link'))
  })

  describe('isWithinRoot', () => {
    it('accepts a file contained in the root', () => {
      expect(isWithinRoot(root.path, join(root.path, 'sub', 'file.ts'))).toBe(true)
    })

    it('accepts the root itself', () => {
      expect(isWithinRoot(root.path, root.path)).toBe(true)
    })

    it('accepts a not-yet-existing path lexically inside the root', () => {
      expect(isWithinRoot(root.path, join(root.path, 'sub', 'ghost.ts'))).toBe(true)
    })

    it('rejects a parent-traversal escape without touching the filesystem', () => {
      expect(isWithinRoot(root.path, join(root.path, '..', 'escape.ts'))).toBe(false)
    })

    it('rejects an absolute path outside the root', () => {
      expect(isWithinRoot(root.path, '/totally/outside/secret')).toBe(false)
    })

    it('rejects a sibling whose name merely shares the root prefix', () => {
      expect(isWithinRoot(root.path, `${root.path}-evil/file.ts`)).toBe(false)
    })

    it('rejects an in-tree symlink that resolves outside the root', () => {
      expect(isWithinRoot(root.path, join(root.path, 'link', 'secret.txt'))).toBe(false)
    })
  })
})
