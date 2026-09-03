import type { PackageJson } from '../../models'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { inheritFields } from './inherit-fields'

describe('inheritFields', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'builder-inherit-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('returns target unchanged when spec is omitted', () => {
    const target: PackageJson = { name: 'foo' }
    expect(inheritFields(target)).toBe(target)
  })

  it('returns target unchanged when source file does not exist', () => {
    const target: PackageJson = { name: 'foo' }
    const result = inheritFields(target, { from: join(root, 'missing.json'), fields: ['repository'] })
    expect(result).toEqual(target)
  })

  it('copies the requested fields from the source onto the target', () => {
    const sourcePath = join(root, 'pkg.json')
    writeFileSync(sourcePath, JSON.stringify({ repository: { type: 'git', url: 'https://example.com/x.git' }, author: 'A' }))
    const result = inheritFields({ name: 'foo' }, { from: sourcePath, fields: ['repository', 'author'] })
    expect(result).toEqual({ name: 'foo', repository: { type: 'git', url: 'https://example.com/x.git' }, author: 'A' })
  })

  it('skips fields that are not present in the source', () => {
    const sourcePath = join(root, 'pkg.json')
    writeFileSync(sourcePath, JSON.stringify({ author: 'A' }))
    const result = inheritFields({ name: 'foo' }, { from: sourcePath, fields: ['repository', 'author'] })
    expect(result).toEqual({ name: 'foo', author: 'A' })
  })

  it('does not mutate the input target', () => {
    const sourcePath = join(root, 'pkg.json')
    writeFileSync(sourcePath, JSON.stringify({ author: 'A' }))
    const target: PackageJson = { name: 'foo' }
    inheritFields(target, { from: sourcePath, fields: ['author'] })
    expect(target).toEqual({ name: 'foo' })
  })

  it('overrides existing target field values when the source provides them', () => {
    const sourcePath = join(root, 'pkg.json')
    writeFileSync(sourcePath, JSON.stringify({ author: 'WORKSPACE' }))
    const result = inheritFields({ name: 'foo', author: 'OLD' }, { from: sourcePath, fields: ['author'] })
    expect(result.author).toBe('WORKSPACE')
  })
})
