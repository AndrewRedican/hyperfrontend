import type { EntryPoint } from '../../models'
import { resolveEntries } from './resolve-entries'

const entry = (exportPath: string, srcPath = exportPath.replace(/^\.\/?/, '')): EntryPoint => ({
  exportPath,
  srcPath,
  inputFile: `/abs/src/${srcPath || 'index'}.ts`,
  isRoot: exportPath === '.',
})

const ENTRIES: EntryPoint[] = [entry('.'), entry('./browser'), entry('./browser/v1'), entry('./browser/v2'), entry('./node')]

describe('resolveEntries', () => {
  it('returns every entry when no entry or exclude pattern is provided', () => {
    expect(resolveEntries({}, ENTRIES)).toEqual(ENTRIES)
  })

  it('matches an exact subpath supplied as a string', () => {
    expect(resolveEntries({ entry: './browser' }, ENTRIES)).toEqual([expect.objectContaining({ exportPath: './browser' })])
  })

  it('normalizes patterns missing the leading "./"', () => {
    expect(resolveEntries({ entry: 'browser' }, ENTRIES)).toEqual([expect.objectContaining({ exportPath: './browser' })])
  })

  it('expands glob patterns to every matching entry', () => {
    expect(resolveEntries({ entry: './browser/*' }, ENTRIES)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exportPath: './browser/v1' }),
        expect.objectContaining({ exportPath: './browser/v2' }),
      ])
    )
  })

  it('accepts multiple entry patterns supplied as an array', () => {
    expect(resolveEntries({ entry: ['.', './node'] }, ENTRIES)).toEqual([
      expect.objectContaining({ exportPath: '.' }),
      expect.objectContaining({ exportPath: './node' }),
    ])
  })

  it('removes entries that match an exclude pattern', () => {
    expect(resolveEntries({ exclude: './browser/*' }, ENTRIES)).toEqual([
      expect.objectContaining({ exportPath: '.' }),
      expect.objectContaining({ exportPath: './browser' }),
      expect.objectContaining({ exportPath: './node' }),
    ])
  })

  it('supports a single string exclude pattern', () => {
    expect(resolveEntries({ exclude: '.' }, ENTRIES)).toEqual([
      expect.objectContaining({ exportPath: './browser' }),
      expect.objectContaining({ exportPath: './browser/v1' }),
      expect.objectContaining({ exportPath: './browser/v2' }),
      expect.objectContaining({ exportPath: './node' }),
    ])
  })
})
