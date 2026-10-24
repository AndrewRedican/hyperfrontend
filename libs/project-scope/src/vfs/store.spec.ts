import { after } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { diskStore } from './store'

const DIR = createTempDir({ prefix: 'project-scope-store-', tree: { 'file.txt': 'text' } })
const ROOT = DIR.path
const FILE = DIR.resolve('file.txt')
after(() => DIR.remove())

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
    expect(diskStore.isSymlink(DIR.resolve('missing'))).toBe(false)
  })
})
