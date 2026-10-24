import type { PackageJson } from '../../models'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { inheritFields } from './inherit-fields'

describe('inheritFields', () => {
  const dir = useTempDir({ prefix: 'builder-inherit-' })

  it('returns target unchanged when spec is omitted', () => {
    const target: PackageJson = { name: 'foo' }
    expect(inheritFields(target)).toBe(target)
  })

  it('returns target unchanged when source file does not exist', () => {
    const target: PackageJson = { name: 'foo' }
    const result = inheritFields(target, { from: dir.resolve('missing.json'), fields: ['repository'] })
    expect(result).toEqual(target)
  })

  it('copies the requested fields from the source onto the target', () => {
    const sourcePath = dir.write('pkg.json', { repository: { type: 'git', url: 'https://example.com/x.git' }, author: 'A' })
    const result = inheritFields({ name: 'foo' }, { from: sourcePath, fields: ['repository', 'author'] })
    expect(result).toEqual({ name: 'foo', repository: { type: 'git', url: 'https://example.com/x.git' }, author: 'A' })
  })

  it('skips fields that are not present in the source', () => {
    const sourcePath = dir.write('pkg.json', { author: 'A' })
    const result = inheritFields({ name: 'foo' }, { from: sourcePath, fields: ['repository', 'author'] })
    expect(result).toEqual({ name: 'foo', author: 'A' })
  })

  it('does not mutate the input target', () => {
    const sourcePath = dir.write('pkg.json', { author: 'A' })
    const target: PackageJson = { name: 'foo' }
    inheritFields(target, { from: sourcePath, fields: ['author'] })
    expect(target).toEqual({ name: 'foo' })
  })

  it('overrides existing target field values when the source provides them', () => {
    const sourcePath = dir.write('pkg.json', { author: 'WORKSPACE' })
    const result = inheritFields({ name: 'foo', author: 'OLD' }, { from: sourcePath, fields: ['author'] })
    expect(result.author).toBe('WORKSPACE')
  })
})
