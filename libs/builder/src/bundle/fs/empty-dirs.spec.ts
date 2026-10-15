import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
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

  const exists = (...relPaths: string[]): boolean[] => relPaths.map((relPath) => existsSync(join(root, relPath)))

  it('counts a single removed empty directory', () => {
    dir('generate')
    expect(removeEmptyDirs(root)).toBe(1)
  })

  it('removes a single empty directory', () => {
    const empty = dir('generate')
    removeEmptyDirs(root)
    expect(existsSync(empty)).toBe(false)
  })

  it('counts every directory of a nested empty chain', () => {
    dir('json/types/inner')
    expect(removeEmptyDirs(root)).toBe(3)
  })

  it('removes nested empty directories post-order', () => {
    dir('json/types/inner')
    removeEmptyDirs(root)
    expect(exists('json/types/inner', 'json')).toEqual([false, false])
  })

  it('counts nothing when a directory holds a file', () => {
    file('bundle/index.js')
    expect(removeEmptyDirs(root)).toBe(0)
  })

  it('keeps a directory that holds a file', () => {
    const kept = file('bundle/index.js')
    removeEmptyDirs(root)
    expect(existsSync(kept)).toBe(true)
  })

  it('counts a parent and its only empty child', () => {
    dir('schema/validate')
    expect(removeEmptyDirs(root)).toBe(2)
  })

  it('removes a parent whose only child is an empty dir', () => {
    dir('schema/validate')
    removeEmptyDirs(root)
    expect(existsSync(join(root, 'schema'))).toBe(false)
  })

  it('counts only the empty sibling subtree beside a directory with a file', () => {
    file('data/shared/keep.d.ts')
    dir('data/orphan/leaf')
    expect(removeEmptyDirs(root)).toBe(2)
  })

  it('keeps a directory with a file while pruning its empty sibling subtree', () => {
    file('data/shared/keep.d.ts')
    dir('data/orphan/leaf')
    removeEmptyDirs(root)
    expect(exists('data/orphan/leaf', 'data/orphan', 'data/shared/keep.d.ts', 'data/shared')).toEqual([false, false, true, true])
  })

  it('counts nothing for an empty root', () => {
    expect(removeEmptyDirs(root)).toBe(0)
  })

  it('never removes the root itself even when empty', () => {
    removeEmptyDirs(root)
    expect(existsSync(root)).toBe(true)
  })
})
