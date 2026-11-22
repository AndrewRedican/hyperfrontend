import type { ReleaseEntry } from './release-files'
import type { ReleaseManifest } from './release-format'
import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempDir, useTempDir } from '@hyperfrontend/testing/fs'
import { createReleaseManifest, releaseManifestDigest, verifyRelease } from './release-files'
import { serializeReleaseManifest } from './release-format'

// note: The published SHA-256 test vectors of the empty message and of "abc".
const SHA_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

// note: A manifest written for a built shell, with the digest recorded for its canonical bytes.
const EXAMPLE: ReleaseManifest = {
  schema: 1,
  name: '@hyperfrontend/demo-clock-shell',
  version: '0.3.0',
  files: [
    { path: 'README.md', size: 1539, sha256: '3719cf3639e574bc5f06b2b915477a75c69f1b8e5eddfe38c1ca429812ee30be' },
    { path: 'index.cjs', size: 319079, sha256: '08e352c8dd2caad177b1a550f37d229c8b61730824b7ca57ea37a88278e702e6' },
    { path: 'index.d.ts', size: 17765, sha256: 'dad11a43ebf12db2e8e290f2d6f1b94ebcd79a86d66e74e15383874e1b61643c' },
    { path: 'index.d.ts.map', size: 6555, sha256: 'e7cbacf699f5adda5105e5c24256319bfbd6868586fce17f87b7c343d52f0bff' },
    { path: 'index.mjs', size: 319046, sha256: '6f671740bd66e11538f0081dd8b32e44d92129a1ec5a9167a964f6e39b032a14' },
    { path: 'metadata.json', size: 7831, sha256: '0fca7f7354d84446e8a393b6c633866407dfd18299843a71efefd92f8a90efa3' },
    { path: 'package.json', size: 505, sha256: 'c21e68ff1da3dac9ce83d330899a9513b1c8f52670bd880af3c00d23877a5889' },
  ],
}

const IDENTITY = { name: '@scope/clock-shell', version: '1.2.3' }

// note: Typed as a manifest and not one: its one path climbs out of the root it is verified against.
const ESCAPING = { schema: 1, ...IDENTITY, files: [{ path: '../outside/copy.mjs', size: 3, sha256: SHA_ABC }] } as ReleaseManifest

// why: A junction links a directory on Windows without the symlink privilege, and the type is ignored elsewhere.
const linkDirectory = (target: string, link: string): void => symlinkSync(target, link, 'junction')

// why: Windows creates a file symlink only for an elevated or developer-mode account, so the case that needs one is skipped where the platform refuses.
const fileLinksAllowed = ((): boolean => {
  const probe = createTempDir({ prefix: 'hf-release-link-probe-' })
  try {
    symlinkSync(probe.write('target.txt', 'target'), probe.resolve('link.txt'), 'file')
    return true
  } catch {
    return false
  } finally {
    probe.remove()
  }
})()

const itWithFileLinks = fileLinksAllowed ? it : it.skip

// how: Lists the given native paths as regular files, whatever root is asked.
const listing =
  (...paths: string[]) =>
  (): readonly ReleaseEntry[] =>
    paths.map((path) => ({ path, kind: 'file' }))

const pathsOf = (manifest: ReleaseManifest): readonly string[] => manifest.files.map((file) => file.path)

describe('releaseManifestDigest', () => {
  it('hashes the bytes for the digest', () => {
    expect(releaseManifestDigest(Buffer.from('abc'))).toBe(SHA_ABC)
  })

  it('hashes a text as its UTF-8 bytes', () => {
    expect(releaseManifestDigest('h\u00e9')).toBe(releaseManifestDigest(Buffer.from([0x68, 0xc3, 0xa9])))
  })

  it('gives the canonical bytes of a shell manifest their recorded digest', () => {
    expect(releaseManifestDigest(serializeReleaseManifest(EXAMPLE))).toBe(
      'd27d3f3235344c4575a22d2c35e17d029779f3efe6a385a9f2883ecfd0998311'
    )
  })
})

describe('createReleaseManifest', () => {
  const tmp = useTempDir({ prefix: 'hf-release-create-' })

  // how: Indexes the temporary directory under the identity every case shares.
  const created = (): ReleaseManifest => createReleaseManifest({ root: tmp.path, ...IDENTITY })

  it('lists nested files with forward slashes', () => {
    tmp.writeTree({ 'index.mjs': 'abc', 'assets/img/logo.svg': '<svg/>' })
    expect(pathsOf(created())).toEqual(['assets/img/logo.svg', 'index.mjs'])
  })

  it('includes dotfiles', () => {
    tmp.writeTree({ '.npmignore': '', '.config/tool.json': '{}', 'index.mjs': 'abc' })
    expect(pathsOf(created())).toEqual(['.config/tool.json', '.npmignore', 'index.mjs'])
  })

  it('leaves the manifest out of its own list', () => {
    tmp.writeTree({ 'hf-release.json': 'stale', 'index.mjs': 'abc' })
    expect(pathsOf(created())).toEqual(['index.mjs'])
  })

  it('lists a manifest file below the root like any other file', () => {
    tmp.writeTree({ 'nested/hf-release.json': '{}', 'index.mjs': 'abc' })
    expect(pathsOf(created())).toEqual(['index.mjs', 'nested/hf-release.json'])
  })

  it('stamps schema 1 with the name and version it is given', () => {
    tmp.writeTree({ 'index.mjs': 'abc' })
    expect(created()).toEqual({ schema: 1, name: '@scope/clock-shell', version: '1.2.3', files: [expect.any(Object)] })
  })

  it('records the size and the SHA-256 of each file', () => {
    tmp.writeTree({ 'empty.txt': '', 'index.mjs': 'abc' })
    expect(created().files).toEqual([
      { path: 'empty.txt', size: 0, sha256: SHA_EMPTY },
      { path: 'index.mjs', size: 3, sha256: SHA_ABC },
    ])
  })

  it('records the size of the bytes read', () => {
    const fileSystem = { list: listing('index.mjs'), read: () => Buffer.from('abc') }
    expect(createReleaseManifest({ root: tmp.path, ...IDENTITY }, fileSystem).files).toEqual([
      { path: 'index.mjs', size: 3, sha256: SHA_ABC },
    ])
  })

  it('reads each file once, by its native path under the root', () => {
    tmp.writeTree({ 'index.mjs': 'abc', 'assets/app.css': 'body{}' })
    const read = jest.fn<[string], Buffer>(() => Buffer.from('abc'))
    createReleaseManifest({ root: tmp.path, ...IDENTITY }, { read })
    expect(read.mock.calls.map(([path]) => path).sort()).toEqual([join(tmp.path, 'assets', 'app.css'), join(tmp.path, 'index.mjs')])
  })

  it('reads a listed file from disk when only the listing is given', () => {
    tmp.writeTree({ 'index.mjs': 'abc', 'unlisted.txt': 'left out' })
    expect(createReleaseManifest({ root: tmp.path, ...IDENTITY }, { list: listing('index.mjs') }).files).toEqual([
      { path: 'index.mjs', size: 3, sha256: SHA_ABC },
    ])
  })

  it('sorts the files by Unicode code point', () => {
    const fileSystem = { list: listing('\u{1f600}.svg', '\uffff.svg', 'b.js', 'B.js'), read: () => Buffer.from('abc') }
    expect(pathsOf(createReleaseManifest({ root: tmp.path, ...IDENTITY }, fileSystem))).toEqual([
      'B.js',
      'b.js',
      '\uffff.svg',
      '\u{1f600}.svg',
    ])
  })

  it('refuses a symbolic link by name', () => {
    tmp.writeTree({ 'shell/index.mjs': 'abc', 'outside/secret.txt': 'secret' })
    linkDirectory(tmp.resolve('outside'), tmp.resolve('shell', 'linked'))
    expect(() => createReleaseManifest({ root: tmp.resolve('shell'), ...IDENTITY })).toThrow('"linked"')
  })

  it('names every entry that is no regular file, in path order', () => {
    const list = (): readonly ReleaseEntry[] => [
      { path: 'socket', kind: 'other' },
      { path: 'index.mjs', kind: 'file' },
      { path: join('assets', 'link'), kind: 'other' },
    ]
    expect(() => createReleaseManifest({ root: 'shell', ...IDENTITY }, { list, read: () => Buffer.from('abc') })).toThrow(
      ['shell: a release holds regular files only, and these entries are something else:', '  - "assets/link"', '  - "socket"'].join('\n')
    )
  })

  it('refuses a manifest file that is no regular file', () => {
    const list = (): readonly ReleaseEntry[] => [
      { path: 'index.mjs', kind: 'file' },
      { path: 'hf-release.json', kind: 'other' },
    ]
    expect(() => createReleaseManifest({ root: 'shell', ...IDENTITY }, { list, read: () => Buffer.from('abc') })).toThrow(
      ['shell: a release holds regular files only, and these entries are something else:', '  - "hf-release.json"'].join('\n')
    )
  })

  it('escapes the control characters a JSON text leaves raw in a name it refuses', () => {
    const list = (): readonly ReleaseEntry[] => [{ path: 'a\u009b2J\u007f', kind: 'other' }]
    expect(() => createReleaseManifest({ root: 'shell', ...IDENTITY }, { list, read: () => Buffer.from('abc') })).toThrow(
      '  - "a\\u009b2J\\u007f"'
    )
  })

  it('reads no file of a directory it refuses', () => {
    const read = jest.fn<[string], Buffer>(() => Buffer.from('abc'))
    const list = (): readonly ReleaseEntry[] => [
      { path: 'index.mjs', kind: 'file' },
      { path: 'link', kind: 'other' },
    ]
    try {
      createReleaseManifest({ root: 'shell', ...IDENTITY }, { list, read })
    } catch {
      // note: The refusal itself is asserted by the cases above; this one reads what it left untouched.
    }
    expect(read.mock.calls).toEqual([])
  })

  it('refuses an empty directory', () => {
    expect(() => created()).toThrow(
      [`${join(tmp.path, 'hf-release.json')}: invalid release manifest:`, '  - files must list at least one file.'].join('\n')
    )
  })

  it('refuses a directory that holds only its manifest', () => {
    tmp.writeTree({ 'hf-release.json': 'stale' })
    expect(() => created()).toThrow('files must list at least one file.')
  })

  it('refuses a name the schema does not take', () => {
    tmp.writeTree({ 'index.mjs': 'abc' })
    expect(() => createReleaseManifest({ root: tmp.path, name: 'clock shell', version: '1.2.3' })).toThrow(
      'name must be a non-empty string with no whitespace, control character or U+FFFD.'
    )
  })

  it('refuses a file whose name a manifest cannot list', () => {
    const fileSystem = { list: listing('index\u0001.mjs'), read: () => Buffer.from('abc') }
    expect(() => createReleaseManifest({ root: tmp.path, ...IDENTITY }, fileSystem)).toThrow('files[0].path must be a relative path')
  })

  it('lets a root that is no directory through as a failure', () => {
    expect(() => createReleaseManifest({ root: tmp.resolve('absent'), ...IDENTITY })).toThrow('Directory not found')
  })
})

describe('verifyRelease', () => {
  const tmp = useTempDir({
    prefix: 'hf-release-verify-',
    tree: { 'shell/index.mjs': 'abc', 'shell/assets/app.css': 'body{}', 'shell/package.json': '{}', 'outside/copy.mjs': 'abc' },
  })

  const shell = (...segments: string[]): string => tmp.resolve('shell', ...segments)

  // how: Indexes the shell as it was written, before a case changes what is on disk.
  const indexed = (): ReleaseManifest => createReleaseManifest({ root: shell(), ...IDENTITY })

  it('finds nothing wrong with the directory a manifest was made from', () => {
    expect(verifyRelease(shell(), indexed())).toEqual([])
  })

  it('reports a listed file that is gone', () => {
    const manifest = indexed()
    rmSync(shell('package.json'))
    expect(verifyRelease(shell(), manifest)).toEqual([
      { code: 'file-missing', path: 'package.json', message: 'package.json is listed but no regular file is there.' },
    ])
  })

  it('reports a file whose size differs', () => {
    const manifest = indexed()
    tmp.write(join('shell', 'index.mjs'), 'abcd')
    expect(verifyRelease(shell(), manifest)).toEqual([
      { code: 'file-size-mismatch', path: 'index.mjs', message: 'index.mjs does not have the listed size.' },
    ])
  })

  it('reports a file whose bytes differ at the same size', () => {
    const manifest = indexed()
    tmp.write(join('shell', 'assets', 'app.css'), 'main{}')
    expect(verifyRelease(shell(), manifest)).toEqual([
      { code: 'file-sha256-mismatch', path: 'assets/app.css', message: 'assets/app.css does not have the listed SHA-256.' },
    ])
  })

  it('reports a file the manifest does not list', () => {
    const manifest = indexed()
    tmp.write(join('shell', 'assets', 'extra.css'), 'a{}')
    expect(verifyRelease(shell(), manifest)).toEqual([
      { code: 'file-unlisted', path: 'assets/extra.css', message: 'assets/extra.css is present but not listed.' },
    ])
  })

  it('does not read a file whose size differs', () => {
    const manifest = indexed()
    tmp.write(join('shell', 'index.mjs'), 'abcd')
    const read = jest.fn<[string], Buffer>(() => Buffer.from('abc'))
    verifyRelease(shell(), manifest, { read })
    expect(read.mock.calls).toEqual([[shell('assets', 'app.css')], [shell('package.json')]])
  })

  it('reports listed files in manifest order, then unlisted ones in code point order', () => {
    const manifest = indexed()
    rmSync(shell('package.json'))
    tmp.writeTree({ 'shell/index.mjs': 'abd', 'shell/zeta.txt': 'z', 'shell/Beta.txt': 'B', 'shell/assets/extra.css': 'a{}' })
    expect(verifyRelease(shell(), manifest).map((issue) => `${issue.code} ${issue.path}`)).toEqual([
      'file-sha256-mismatch index.mjs',
      'file-missing package.json',
      'file-unlisted Beta.txt',
      'file-unlisted assets/extra.css',
      'file-unlisted zeta.txt',
    ])
  })

  itWithFileLinks('reports a symbolic link at a listed path as missing', () => {
    const manifest = indexed()
    rmSync(shell('index.mjs'))
    symlinkSync(tmp.resolve('outside', 'copy.mjs'), shell('index.mjs'), 'file')
    expect(verifyRelease(shell(), manifest)).toEqual([
      { code: 'file-missing', path: 'index.mjs', message: 'index.mjs is listed but no regular file is there.' },
    ])
  })

  it('reports a listed path that holds no regular file once, as missing', () => {
    const list = (): readonly ReleaseEntry[] => [{ path: 'index.mjs', kind: 'other' }]
    const manifest: ReleaseManifest = { schema: 1, ...IDENTITY, files: [{ path: 'index.mjs', size: 3, sha256: SHA_ABC }] }
    expect(verifyRelease('shell', manifest, { list, size: () => null }).map((issue) => issue.code)).toEqual(['file-missing'])
  })

  it('reports an unlisted symbolic link', () => {
    const manifest = indexed()
    linkDirectory(tmp.resolve('outside'), shell('linked'))
    expect(verifyRelease(shell(), manifest)).toEqual([
      { code: 'file-unlisted', path: 'linked', message: 'linked is present but not listed.' },
    ])
  })

  it('reports a linked directory above a listed file as unlisted', () => {
    const manifest = indexed()
    rmSync(shell('assets'), { recursive: true })
    tmp.write(join('outside', 'app.css'), 'body{}')
    linkDirectory(tmp.resolve('outside'), shell('assets'))
    expect(verifyRelease(shell(), manifest).map((issue) => `${issue.code} ${issue.path}`)).toEqual(['file-unlisted assets'])
  })

  it('reports a directory at a listed path as missing', () => {
    const manifest = indexed()
    rmSync(shell('package.json'))
    mkdirSync(shell('package.json'))
    expect(verifyRelease(shell(), manifest).map((issue) => `${issue.code} ${issue.path}`)).toEqual(['file-missing package.json'])
  })

  it('reports a listed path below a file as missing', () => {
    const manifest = indexed()
    rmSync(shell('assets'), { recursive: true })
    tmp.write(join('shell', 'assets'), 'no directory')
    expect(verifyRelease(shell(), manifest).map((issue) => `${issue.code} ${issue.path}`)).toEqual([
      'file-missing assets/app.css',
      'file-unlisted assets',
    ])
  })

  it('ignores the manifest file when listing', () => {
    const manifest = indexed()
    tmp.write(join('shell', 'hf-release.json'), serializeReleaseManifest(manifest))
    expect(verifyRelease(shell(), manifest)).toEqual([])
  })

  it('reports a manifest file below the root like any other file', () => {
    const manifest = indexed()
    tmp.write(join('shell', 'assets', 'hf-release.json'), '{}')
    expect(verifyRelease(shell(), manifest).map((issue) => `${issue.code} ${issue.path}`)).toEqual(['file-unlisted assets/hf-release.json'])
  })

  describe('over a directory in memory', () => {
    const manifest: ReleaseManifest = { schema: 1, ...IDENTITY, files: [{ path: 'index.mjs', size: 3, sha256: SHA_ABC }] }

    // how: Verifies the one listed file beside whatever else the case puts in the listing.
    const verified = (...others: ReleaseEntry[]): ReturnType<typeof verifyRelease> =>
      verifyRelease('shell', manifest, {
        list: () => [{ path: 'index.mjs', kind: 'file' }, ...others],
        read: () => Buffer.from('abc'),
        size: () => 3,
      })

    it('reports a manifest file that is a symbolic link', () => {
      expect(verified({ path: 'hf-release.json', kind: 'other' })).toEqual([
        { code: 'manifest-not-file', path: 'hf-release.json', message: 'hf-release.json is not a regular file.' },
      ])
    })

    it('reports a name that did not decode as UTF-8 as unlisted', () => {
      expect(verified({ path: 'a\ufffd.txt', kind: 'file' }, { path: 'a\ufffd.txt', kind: 'file' }).map((issue) => issue.code)).toEqual([
        'file-unlisted',
        'file-unlisted',
      ])
    })

    it('quotes an unlisted name that holds a line break, so it stays one line', () => {
      expect(verified({ path: 'x\nfatal cause=environment', kind: 'file' }).map((issue) => issue.message)).toEqual([
        '"x\\nfatal cause=environment" is present but not listed.',
      ])
    })

    it('escapes an escape character and a C1 control in an unlisted name', () => {
      expect(verified({ path: '\u001b[2J\u009b2J', kind: 'file' }).map((issue) => issue.message)).toEqual([
        '"\\u001b[2J\\u009b2J" is present but not listed.',
      ])
    })

    it('keeps the path of an unlisted entry as the disk gave it', () => {
      expect(verified({ path: 'x\ny', kind: 'file' }).map((issue) => issue.path)).toEqual(['x\ny'])
    })
  })

  it('refuses a manifest that is not valid', () => {
    expect(() => verifyRelease(shell(), ESCAPING)).toThrow(
      `${shell('hf-release.json')}: invalid release manifest:\n  - files[0].path must be a relative path`
    )
  })

  it('examines no file of a manifest it refuses', () => {
    const size = jest.fn<[string], number>(() => 3)
    try {
      verifyRelease(shell(), ESCAPING, { size })
    } catch {
      // note: The refusal itself is asserted by the case above; this one reads what it left untouched.
    }
    expect(size.mock.calls).toEqual([])
  })

  it('lets a failure to examine a listed file through', () => {
    expect(() => verifyRelease('shell\u0000', EXAMPLE)).toThrow('without null bytes')
  })

  it('lets a failure to list the root through', () => {
    expect(() => verifyRelease(tmp.resolve('absent'), EXAMPLE)).toThrow('Directory not found')
  })
})
