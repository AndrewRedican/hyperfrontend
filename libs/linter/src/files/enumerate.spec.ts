import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { enumerateFiles } from './enumerate'

const HERE = import.meta.dirname

describe('enumerateFiles', () => {
  it('names a file as given, explicitly', () => {
    expect(enumerateFiles(['enumerate.ts'], HERE).files).toEqual([{ path: join(HERE, 'enumerate.ts'), explicit: true }])
  })

  it('lists the files under a directory as found', () => {
    expect(enumerateFiles(['.'], HERE).files).toEqual(
      expect.arrayContaining([
        { path: join(HERE, 'enumerate.ts'), explicit: false },
        { path: join(HERE, 'glob.ts'), explicit: false },
      ])
    )
  })

  it('keeps a file explicit when a directory also finds it', () => {
    expect(enumerateFiles(['.', 'glob.ts'], HERE).files.find((file) => file.path.endsWith('glob.ts'))?.explicit).toBe(true)
  })

  it('lists each file once and sorted', () => {
    const paths = enumerateFiles(['glob.ts', '.', 'glob.ts'], HERE).files.map((file) => file.path)
    expect(paths).toEqual([...new Set(paths)].sort())
  })

  it('never enters node_modules', () => {
    expect(
      enumerateFiles(['.'], resolve(HERE, '..', '..', '..', '..')).files.some((file) => file.path.includes(`${sep}node_modules${sep}`))
    ).toBe(false)
  })

  it('expands a glob pattern against the working directory', () => {
    expect(enumerateFiles(['*.spec.ts'], HERE).files.map((file) => file.path)).toEqual([
      join(HERE, 'enumerate.spec.ts'),
      join(HERE, 'glob.spec.ts'),
    ])
  })

  it('reports a pattern that matches nothing', () => {
    expect(enumerateFiles(['*.nope'], HERE)).toEqual({ files: [], unmatched: ['*.nope'] })
  })

  it('reports an argument that names nothing', () => {
    expect(enumerateFiles(['missing.ts'], HERE)).toEqual({ files: [], unmatched: ['missing.ts'] })
  })

  it('resolves an absolute argument as given', () => {
    expect(enumerateFiles([resolve(HERE, 'glob.ts')], '/').files).toEqual([{ path: join(HERE, 'glob.ts'), explicit: true }])
  })
})
