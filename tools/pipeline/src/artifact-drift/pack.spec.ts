import { createHash } from 'node:crypto'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { contentHash, hashContent, parsePackJson } from './pack'

describe('parsePackJson', () => {
  it('reads the name, the version and the files sorted by path', () => {
    const output = JSON.stringify([
      { name: '@scope/pkg', version: '1.2.3', files: [{ path: 'b.js', size: 2 }, { path: 'a.js', size: 1 }, { size: 9 }] },
    ])
    expect(parsePackJson(output)).toEqual({
      name: '@scope/pkg',
      version: '1.2.3',
      files: [
        { path: 'a.js', size: 1 },
        { path: 'b.js', size: 2 },
      ],
    })
  })

  it('reads a pack listing no files', () => {
    expect(parsePackJson('[{"name":"p","version":"0.0.1"}]').files).toEqual([])
  })

  it.each([['[]'], ['{}'], ['[{"version":"1.0.0"}]']])('rejects %s', (output) => {
    expect(() => parsePackJson(output)).toThrow('npm pack --json named no package')
  })
})

describe('contentHash and hashContent', () => {
  it('hashes the sorted path and content-hash lines', () => {
    const expected = createHash('sha256').update('a.js 1\nb.js 2').digest('hex')
    expect(
      contentHash(
        createMap([
          ['b.js', '2'],
          ['a.js', '1'],
        ])
      )
    ).toBe(expected)
  })

  it('hashes content as sha256 hex', () => {
    expect(hashContent('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
