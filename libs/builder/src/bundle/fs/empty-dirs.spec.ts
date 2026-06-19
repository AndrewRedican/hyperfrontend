import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { removeEmptyDirs } from './empty-dirs'

describe('removeEmptyDirs', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-empty-dirs-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const dir = (relPath: string): string => {
    const abs = join(root, relPath)
    mkdirSync(abs, { recursive: true })
    return abs
  }

  const file = (relPath: string): string => {
    const abs = join(root, relPath)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, '')
    return abs
  }

  it('removes a single empty directory and counts it', () => {
    const empty = dir('generate')
    expect(removeEmptyDirs(root)).toBe(1)
    expect(existsSync(empty)).toBe(false)
  })

  it('removes nested empty directories post-order', () => {
    const deep = dir('json/types/inner')
    const removed = removeEmptyDirs(root)
    expect(removed).toBe(3)
    expect(existsSync(deep)).toBe(false)
    expect(existsSync(join(root, 'json'))).toBe(false)
  })

  it('keeps a directory that holds a file', () => {
    const kept = file('bundle/index.js')
    expect(removeEmptyDirs(root)).toBe(0)
    expect(existsSync(kept)).toBe(true)
  })

  it('removes a parent whose only child is an empty dir', () => {
    dir('schema/validate')
    const removed = removeEmptyDirs(root)
    expect(removed).toBe(2)
    expect(existsSync(join(root, 'schema'))).toBe(false)
  })

  it('keeps a directory with a file while pruning its empty sibling subtree', () => {
    const kept = file('data/shared/keep.d.ts')
    const empty = dir('data/orphan/leaf')
    const removed = removeEmptyDirs(root)
    expect(removed).toBe(2)
    expect(existsSync(empty)).toBe(false)
    expect(existsSync(join(root, 'data', 'orphan'))).toBe(false)
    expect(existsSync(kept)).toBe(true)
    expect(existsSync(join(root, 'data', 'shared'))).toBe(true)
  })

  it('never removes the root itself even when empty', () => {
    expect(removeEmptyDirs(root)).toBe(0)
    expect(existsSync(root)).toBe(true)
  })
})
