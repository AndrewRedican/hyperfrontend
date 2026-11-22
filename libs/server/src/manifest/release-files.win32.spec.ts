import type { ReleaseEntry } from './release-files'
import type { ReleaseManifest } from './release-format'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createReleaseManifest, verifyRelease } from './release-files'

// why: a root only carries a drive letter and backslash separators when the module links against the win32 flavour of node:path.
jest.mock('node:path', () => {
  const { win32 } = jest.requireActual<typeof import('node:path')>('node:path')
  return { join: win32.join, sep: win32.sep }
})

const ROOT = 'C:\\srv\\shell'

// note: The published SHA-256 test vector of "abc".
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

const IDENTITY = { name: '@scope/clock-shell', version: '1.2.3' }

const MANIFEST: ReleaseManifest = { schema: 1, ...IDENTITY, files: [{ path: 'assets/img/logo.svg', size: 3, sha256: SHA_ABC }] }

// how: Lists the one file of the release by the path a Windows directory walk gives it.
const list = (): readonly ReleaseEntry[] => [{ path: 'assets\\img\\logo.svg', kind: 'file' }]

describe('createReleaseManifest on Windows', () => {
  it('lists a native backslash path with forward slashes', () => {
    expect(createReleaseManifest({ root: ROOT, ...IDENTITY }, { list, read: () => Buffer.from('abc') })).toEqual(MANIFEST)
  })

  it('reads a file through the native separator', () => {
    const read = jest.fn<[string], Buffer>(() => Buffer.from('abc'))
    createReleaseManifest({ root: ROOT, ...IDENTITY }, { list, read })
    expect(read.mock.calls).toEqual([['C:\\srv\\shell\\assets\\img\\logo.svg']])
  })

  it('names a refused entry with forward slashes', () => {
    const linked = (): readonly ReleaseEntry[] => [{ path: 'assets\\linked', kind: 'other' }]
    expect(() => createReleaseManifest({ root: ROOT, ...IDENTITY }, { list: linked })).toThrow('  - "assets/linked"')
  })

  it('names the manifest file by its native path when it refuses the result', () => {
    expect(() => createReleaseManifest({ root: ROOT, ...IDENTITY }, { list: () => [] })).toThrow(
      'C:\\srv\\shell\\hf-release.json: invalid release manifest:'
    )
  })
})

describe('verifyRelease on Windows', () => {
  it('reads a listed path through the native separator', () => {
    const read = jest.fn<[string], Buffer>(() => Buffer.from('abc'))
    verifyRelease(ROOT, MANIFEST, { list, read, size: () => 3 })
    expect(read.mock.calls).toEqual([['C:\\srv\\shell\\assets\\img\\logo.svg']])
  })

  it('sizes a listed path through the native separator', () => {
    const size = jest.fn<[string], number>(() => 3)
    verifyRelease(ROOT, MANIFEST, { list, read: () => Buffer.from('abc'), size })
    expect(size.mock.calls).toEqual([['C:\\srv\\shell\\assets\\img\\logo.svg']])
  })

  it('matches a native backslash listing against the listed forward-slash path', () => {
    expect(verifyRelease(ROOT, MANIFEST, { list, read: () => Buffer.from('abc'), size: () => 3 })).toEqual([])
  })

  it('reports an unlisted native path with forward slashes', () => {
    const extra = (): readonly ReleaseEntry[] => [...list(), { path: 'assets\\extra.css', kind: 'file' }]
    expect(verifyRelease(ROOT, MANIFEST, { list: extra, read: () => Buffer.from('abc'), size: () => 3 })).toEqual([
      { code: 'file-unlisted', path: 'assets/extra.css', message: 'assets/extra.css is present but not listed.' },
    ])
  })
})
