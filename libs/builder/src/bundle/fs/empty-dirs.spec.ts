import { existsSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { removeEmptyDirs } from './empty-dirs'

describe('removeEmptyDirs', () => {
  const root = useTempDir({ prefix: 'builder-empty-dirs-' })

  const dir = (relPath: string): string => root.mkdir(relPath)

  const file = (relPath: string): string => root.write(relPath, '')

  const surviving = (...relPaths: string[]): string[] => relPaths.filter((relPath) => root.exists(relPath))

  it('counts a single removed empty directory', () => {
    dir('generate')
    expect(removeEmptyDirs(root.path)).toBe(1)
  })

  it('removes a single empty directory', () => {
    const empty = dir('generate')
    removeEmptyDirs(root.path)
    expect(existsSync(empty)).toBe(false)
  })

  it('counts every directory of a nested empty chain', () => {
    dir('json/types/inner')
    expect(removeEmptyDirs(root.path)).toBe(3)
  })

  it('removes nested empty directories post-order', () => {
    dir('json/types/inner')
    removeEmptyDirs(root.path)
    expect(surviving('json/types/inner', 'json/types', 'json')).toEqual([])
  })

  it('counts nothing when a directory holds a file', () => {
    file('bundle/index.js')
    expect(removeEmptyDirs(root.path)).toBe(0)
  })

  it('keeps a directory that holds a file', () => {
    const kept = file('bundle/index.js')
    removeEmptyDirs(root.path)
    expect(existsSync(kept)).toBe(true)
  })

  it('counts a parent and its only empty child', () => {
    dir('schema/validate')
    expect(removeEmptyDirs(root.path)).toBe(2)
  })

  it('removes a parent whose only child is an empty dir', () => {
    dir('schema/validate')
    removeEmptyDirs(root.path)
    expect(root.exists('schema')).toBe(false)
  })

  it('counts only the empty sibling subtree beside a directory with a file', () => {
    file('data/shared/keep.d.ts')
    dir('data/orphan/leaf')
    expect(removeEmptyDirs(root.path)).toBe(2)
  })

  it('keeps a directory with a file while pruning its empty sibling subtree', () => {
    file('data/shared/keep.d.ts')
    dir('data/orphan/leaf')
    removeEmptyDirs(root.path)
    expect(surviving('data/orphan/leaf', 'data/orphan', 'data/shared/keep.d.ts', 'data/shared')).toEqual([
      'data/shared/keep.d.ts',
      'data/shared',
    ])
  })

  it('counts nothing for an empty root', () => {
    expect(removeEmptyDirs(root.path)).toBe(0)
  })

  it('never removes the root itself even when empty', () => {
    removeEmptyDirs(root.path)
    expect(existsSync(root.path)).toBe(true)
  })
})
