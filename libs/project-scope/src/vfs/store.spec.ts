import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { diskStore } from './store'

const ROOT = mkdtempSync(join(tmpdir(), 'project-scope-store-'))
const FILE = join(ROOT, 'file.txt')
writeFileSync(FILE, 'text')
after(() => rmSync(ROOT, { recursive: true, force: true }))

describe('diskStore', () => {
  it('reads a file', () => {
    expect(diskStore.read(FILE)?.toString()).toBe('text')
  })

  it('reads a directory as null', () => {
    expect(diskStore.read(ROOT)).toBeNull()
  })

  it('lists a directory', () => {
    expect(diskStore.list(ROOT)).toEqual(['file.txt'])
  })

  it('lists nothing for a path that is not a directory', () => {
    expect(diskStore.list(FILE)).toEqual([])
  })

  it('reports a missing path as no symbolic link', () => {
    expect(diskStore.isSymlink(join(ROOT, 'missing'))).toBe(false)
  })
})
