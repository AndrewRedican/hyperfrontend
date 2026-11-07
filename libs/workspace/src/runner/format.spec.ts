import { describe, expect, it } from '@hyperfrontend/testing'
import { changedFiles, FILES_PER_RUN, parseFormatArgs, prettierRuns } from './format'

describe('parseFormatArgs', () => {
  it('reads a check of the changed files', () => {
    expect(parseFormatArgs(['--check'])).toEqual({ write: false, scope: 'changed' })
  })

  it('reads a write of every file', () => {
    expect(parseFormatArgs(['--write', '--all'])).toEqual({ write: true, scope: 'all' })
  })

  it('reads the named files', () => {
    expect(parseFormatArgs(['--check', '--files=a.ts,,b.md'])).toEqual({ write: false, scope: ['a.ts', 'b.md'] })
  })

  it('refuses an unknown argument', () => {
    expect(() => parseFormatArgs(['--check', '--projects=x'])).toThrow('unknown argument --projects=x')
  })

  it('refuses neither mode', () => {
    expect(() => parseFormatArgs(['--all'])).toThrow('pass exactly one of --check and --write')
  })
})

describe('changedFiles', () => {
  it('lists added, modified and untracked paths, the new path of a rename, and no deleted path', () => {
    expect(changedFiles('M  a.ts\0 M b.ts\0?? c.ts\0R  new.ts\0old.ts\0 D gone.ts\0A  d.ts\0')).toEqual([
      'a.ts',
      'b.ts',
      'c.ts',
      'new.ts',
      'd.ts',
    ])
  })
})

describe('prettierRuns', () => {
  it('checks the listed files', () => {
    expect(prettierRuns({ write: false, scope: 'changed' }, () => ['a.ts'])).toEqual([
      ['--check', '--ignore-unknown', '--log-level=warn', '--', 'a.ts'],
    ])
  })

  it('writes the named files without listing', () => {
    expect(prettierRuns({ write: true, scope: ['b.ts'] }, () => ['a.ts'])).toEqual([
      ['--write', '--ignore-unknown', '--log-level=warn', '--', 'b.ts'],
    ])
  })

  it('runs nothing when no file is listed', () => {
    expect(prettierRuns({ write: false, scope: 'all' }, () => [])).toEqual([])
  })

  it('splits a long list into runs of bounded size', () => {
    const files = Array.from({ length: FILES_PER_RUN + 1 }, (_, index) => `f${index}.ts`)
    expect(prettierRuns({ write: false, scope: 'all' }, () => files).map((run) => run.length - 4)).toEqual([FILES_PER_RUN, 1])
  })
})
