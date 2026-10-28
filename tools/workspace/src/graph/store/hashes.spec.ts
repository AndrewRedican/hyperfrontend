import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { blobHashes, canonicalJson, digestOf, sha256, sourcesHash } from './hashes'

describe('canonicalJson', () => {
  it('sorts the keys at every depth and keeps arrays in order', () => {
    expect(canonicalJson({ b: [{ d: 1, c: 2 }, 'x'], a: null, c: { z: true, y: undefined } })).toBe(
      '{"a":null,"b":[{"c":2,"d":1},"x"],"c":{"z":true}}'
    )
  })
})

describe('sha256 and digestOf', () => {
  it('hashes text as sha256 hex', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('digests the canonical text of a body', () => {
    expect(digestOf({ b: 1, a: 2 })).toBe(sha256('{"a":2,"b":1}'))
  })
})

describe('blobHashes', () => {
  it('answers the blob ids git computes for the files, in one call', () => {
    const directory = createTempDir({ prefix: 'blob-', tree: { 'a.txt': 'a\n', 'b.txt': 'b\n' } })
    execFileSync('git', ['init', '-q'], { cwd: directory.path })
    const expected = execFileSync('git', ['hash-object', 'a.txt', 'b.txt'], { cwd: directory.path, encoding: 'utf8' }).trim().split(/\r?\n/)
    try {
      expect([...blobHashes(directory.path, ['a.txt', 'b.txt'])]).toEqual([
        ['a.txt', expected[0]],
        ['b.txt', expected[1]],
      ])
    } finally {
      directory.remove()
    }
  })

  it('answers nothing for no paths without running git', () => {
    expect(blobHashes('/nowhere', []).size).toBe(0)
  })
})

describe('sourcesHash', () => {
  it('hashes the names and contents of the sources in path order, specs and test utilities left out', () => {
    const directory = createTempDir({
      prefix: 'sources-',
      tree: {
        'b.ts': 'export const b = 1\n',
        'a.ts': 'export const a = 1\n',
        'a.spec.ts': 'spec\n',
        'README.md': 'docs\n',
        'sub/c.ts': 'export const c = 1\n',
        '__test-utils__/d.ts': 'util\n',
      },
    })
    const expected = createHash('sha256')
      .update('a.ts')
      .update('export const a = 1\n')
      .update('b.ts')
      .update('export const b = 1\n')
      .update('c.ts')
      .update('export const c = 1\n')
      .digest('hex')
    try {
      expect(sourcesHash(directory.path)).toBe(expected)
    } finally {
      directory.remove()
    }
  })
})
