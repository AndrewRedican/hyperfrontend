import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isWithinRoot } from './confine'

const ROOT = join(import.meta.dirname, '__confine_fixtures__')
const OUTSIDE = join(import.meta.dirname, '__confine_outside__')

describe('core/path/confine', () => {
  beforeAll(() => {
    rmSync(ROOT, { recursive: true, force: true })
    rmSync(OUTSIDE, { recursive: true, force: true })
    mkdirSync(join(ROOT, 'sub'), { recursive: true })
    writeFileSync(join(ROOT, 'sub', 'file.ts'), 'export const a = 1')
    mkdirSync(OUTSIDE, { recursive: true })
    writeFileSync(join(OUTSIDE, 'secret.txt'), 'secret')
    symlinkSync(OUTSIDE, join(ROOT, 'link'))
  })

  afterAll(() => {
    rmSync(ROOT, { recursive: true, force: true })
    rmSync(OUTSIDE, { recursive: true, force: true })
  })

  describe('isWithinRoot', () => {
    it('accepts a file contained in the root', () => {
      expect(isWithinRoot(ROOT, join(ROOT, 'sub', 'file.ts'))).toBe(true)
    })

    it('accepts the root itself', () => {
      expect(isWithinRoot(ROOT, ROOT)).toBe(true)
    })

    it('accepts a not-yet-existing path lexically inside the root', () => {
      expect(isWithinRoot(ROOT, join(ROOT, 'sub', 'ghost.ts'))).toBe(true)
    })

    it('rejects a parent-traversal escape without touching the filesystem', () => {
      expect(isWithinRoot(ROOT, join(ROOT, '..', 'escape.ts'))).toBe(false)
    })

    it('rejects an absolute path outside the root', () => {
      expect(isWithinRoot(ROOT, '/totally/outside/secret')).toBe(false)
    })

    it('rejects a sibling whose name merely shares the root prefix', () => {
      expect(isWithinRoot(ROOT, `${ROOT}-evil/file.ts`)).toBe(false)
    })

    it('rejects an in-tree symlink that resolves outside the root', () => {
      expect(isWithinRoot(ROOT, join(ROOT, 'link', 'secret.txt'))).toBe(false)
    })
  })
})
