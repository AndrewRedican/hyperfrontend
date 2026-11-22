import type { ReleaseManifest } from './release-format'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  checkReleaseManifest,
  isReleasePath,
  compareCodePoints,
  parseReleaseManifest,
  RELEASE_MANIFEST_FILENAME,
  serializeReleaseManifest,
  validateReleaseManifest,
} from './release-format'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)

// how: One sound file entry at a path, so a case states only the member it is about.
const fileAt = (path: string): Record<string, unknown> => ({ path, size: 3, sha256: SHA_A })

// how: A sound manifest with the given members laid over it; a case overrides the one member it breaks.
const manifestWith = (members: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: 1,
  name: '@scope/clock-shell',
  version: '1.2.3',
  files: [fileAt('index.mjs'), fileAt('package.json')],
  ...members,
})

// how: A sound manifest holding exactly the given file entries.
const manifestOf = (...files: unknown[]): Record<string, unknown> => manifestWith({ files })

const codesOf = (value: unknown): readonly string[] => checkReleaseManifest(value).map((issue) => issue.code)

const CANONICAL = [
  '{',
  '  "schema": 1,',
  '  "name": "@scope/clock-shell",',
  '  "version": "1.2.3",',
  '  "files": [',
  '    {',
  '      "path": "index.mjs",',
  '      "size": 3,',
  `      "sha256": "${SHA_A}"`,
  '    }',
  '  ]',
  '}',
  '',
].join('\n')

// how: Reads the message a refused text is thrown with, or null when the text is accepted.
const refusalOf = (text: string): string | null => {
  try {
    parseReleaseManifest(text, 'shell/hf-release.json')
    return null
  } catch (error) {
    return (error as Error).message
  }
}

describe('RELEASE_MANIFEST_FILENAME', () => {
  it('names the manifest file', () => {
    expect(RELEASE_MANIFEST_FILENAME).toBe('hf-release.json')
  })
})

describe('checkReleaseManifest', () => {
  it('finds nothing wrong with a sound manifest', () => {
    expect(checkReleaseManifest(manifestWith())).toEqual([])
  })

  it.each([
    ['null', null],
    ['an array', [manifestWith()]],
    ['a string', 'hf-release.json'],
  ])('reports %s as no object', (_label: string, value: unknown) => {
    expect(checkReleaseManifest(value)).toEqual([{ code: 'manifest-not-object', path: '', message: 'the manifest must be an object.' }])
  })

  it('reports a missing schema alone', () => {
    expect(checkReleaseManifest({ name: '', files: [] })).toEqual([
      { code: 'schema-missing', path: 'schema', message: 'schema is required.' },
    ])
  })

  it('reports an unsupported schema', () => {
    expect(checkReleaseManifest(manifestWith({ schema: 2 }))).toEqual([
      { code: 'schema-unsupported', path: 'schema', message: 'schema is not one this reader supports; it supports 1.' },
    ])
  })

  it('reports only the schema when the schema is not 1', () => {
    expect(codesOf({ schema: '1', name: '', version: 'v1', files: [], extra: true })).toEqual(['schema-unsupported'])
  })

  it('reports an unknown member of the manifest by its holder', () => {
    expect(checkReleaseManifest(manifestWith({ created: 'now', kind: 'shell' }))).toEqual([
      { code: 'member-unknown', path: '', message: 'the manifest holds a member schema 1 does not define.' },
    ])
  })

  it('reports an unknown member of a file by its holder', () => {
    expect(checkReleaseManifest(manifestOf({ ...fileAt('index.mjs'), mode: 420 }))).toEqual([
      { code: 'member-unknown', path: 'files[0]', message: 'files[0] holds a member schema 1 does not define.' },
    ])
  })

  it.each([
    ['is missing', undefined],
    ['is no string', 7],
    ['is empty', ''],
    ['holds a space', 'clock shell'],
    ['holds a no-break space', 'clock\u00a0shell'],
    ['holds a line feed', 'clock\nshell'],
    ['holds a C1 control character', 'clock\u0085shell'],
    ['holds a lone surrogate', 'clock\ud800shell'],
    ['holds the replacement character', 'clock\ufffdshell'],
  ])('reports a name that %s', (_label: string, name: unknown) => {
    expect(checkReleaseManifest(manifestWith({ name }))).toEqual([
      { code: 'name-invalid', path: 'name', message: 'name must be a non-empty string with no whitespace, control character or U+FFFD.' },
    ])
  })

  it.each([
    ['a missing version', undefined],
    ['a number', 1],
    ['a leading v', 'v1.2.3'],
    ['two parts', '1.2'],
    ['a leading zero', '1.02.3'],
    ['an empty prerelease identifier', '1.2.3-'],
    ['a numeric prerelease identifier with a leading zero', '1.2.3-01'],
    ['an empty build identifier', '1.2.3+'],
    ['four parts', '1.2.3.4'],
    ['a prerelease identifier outside the alphabet', '1.2.3-rc_1'],
    ['a second build mark', '1.2.3+a+b'],
    ['a trailing line feed', '1.2.3\n'],
  ])('reports %s as no version', (_label: string, version: unknown) => {
    expect(checkReleaseManifest(manifestWith({ version }))).toEqual([
      { code: 'version-invalid', path: 'version', message: 'version must be a semantic version such as 1.2.3, with no leading "v".' },
    ])
  })

  it.each(['0.0.0', '1.2.3-rc.1', '1.2.3-0a.x-y', '1.2.3+build-5.x', '10.20.30-alpha.0+001'])(
    'accepts the version %s',
    (version: string) => {
      expect(checkReleaseManifest(manifestWith({ version }))).toEqual([])
    }
  )

  it.each([
    ['missing', undefined],
    ['an object', { 0: fileAt('index.mjs') }],
  ])('reports files that are %s as no array', (_label: string, files: unknown) => {
    expect(checkReleaseManifest(manifestWith({ files }))).toEqual([
      { code: 'files-not-array', path: 'files', message: 'files must be an array.' },
    ])
  })

  it('reports an empty file list', () => {
    expect(checkReleaseManifest(manifestOf())).toEqual([
      { code: 'files-empty', path: 'files', message: 'files must list at least one file.' },
    ])
  })

  it.each([
    ['a string', 'index.mjs'],
    ['null', null],
    ['an array', [fileAt('index.mjs')]],
  ])('reports a file that is %s as no object', (_label: string, entry: unknown) => {
    expect(checkReleaseManifest(manifestOf(fileAt('a.js'), entry))).toEqual([
      { code: 'file-not-object', path: 'files[1]', message: 'files[1] must be an object.' },
    ])
  })

  it.each([
    ['missing', undefined],
    ['no string', 4],
    ['empty', ''],
    ['absolute', '/index.mjs'],
    ['closed by a separator', 'assets/'],
    ['holding an empty segment', 'assets//app.js'],
    ['holding a "." segment', './index.mjs'],
    ['holding a ".." segment', 'assets/../index.mjs'],
    ['holding a backslash', 'assets\\app.js'],
    ['holding a control character', 'index\u0000.mjs'],
    ['holding a lone surrogate', 'index\udc00.mjs'],
    ['holding the replacement character', 'index\ufffd.mjs'],
  ])('reports a path that is %s', (_label: string, path: unknown) => {
    expect(checkReleaseManifest(manifestOf({ ...fileAt('a'), path }))).toEqual([
      {
        code: 'file-path-invalid',
        path: 'files[0].path',
        message:
          'files[0].path must be a relative path with "/" separators and no empty, "." or ".." segment, backslash, control character or U+FFFD.',
      },
    ])
  })

  it.each(['a b.txt', '.npmignore', '...', 'assets/hf-release.json', 'HF-RELEASE.JSON', 'caf\u00e9/\u{1f600}.svg'])(
    'accepts the path %s',
    (path: string) => {
      expect(checkReleaseManifest(manifestOf(fileAt(path)))).toEqual([])
    }
  )

  it('reports a path that names the manifest itself', () => {
    expect(checkReleaseManifest(manifestOf(fileAt('hf-release.json'), fileAt('index.mjs')))).toEqual([
      {
        code: 'file-path-reserved',
        path: 'files[0].path',
        message: 'files[0].path names the manifest itself, which a manifest never lists.',
      },
    ])
  })

  it('reports a path that sorts before the one ahead of it', () => {
    expect(checkReleaseManifest(manifestOf(fileAt('index.mjs'), fileAt('index.cjs')))).toEqual([
      {
        code: 'file-path-order',
        path: 'files[1].path',
        message: 'files[1].path must sort after the path before it: paths ascend by Unicode code point and none repeats.',
      },
    ])
  })

  it('reports a repeated path as out of order', () => {
    expect(codesOf(manifestOf(fileAt('index.mjs'), fileAt('index.mjs')))).toEqual(['file-path-order'])
  })

  it('compares a path that follows the reserved one against it', () => {
    expect(codesOf(manifestOf(fileAt('hf-release.json'), fileAt('a.js')))).toEqual(['file-path-reserved', 'file-path-order'])
  })

  it('restarts the order check after an invalid path', () => {
    expect(codesOf(manifestOf(fileAt('m.js'), fileAt('../z.js'), fileAt('a.js'), fileAt('b.js')))).toEqual(['file-path-invalid'])
  })

  it('restarts the order check after an entry that is no object', () => {
    expect(codesOf(manifestOf(fileAt('m.js'), null, fileAt('a.js')))).toEqual(['file-not-object'])
  })

  it('orders an astral character after U+FFFF', () => {
    expect(checkReleaseManifest(manifestOf(fileAt('\uffff.svg'), fileAt('\u{1f600}.svg')))).toEqual([])
  })

  it('reports an astral character listed before U+FFFF as out of order', () => {
    expect(codesOf(manifestOf(fileAt('\u{1f600}.svg'), fileAt('\uffff.svg')))).toEqual(['file-path-order'])
  })

  it.each([
    ['missing', undefined],
    ['a string', '3'],
    ['negative', -1],
    ['fractional', 1.5],
    ['beyond the largest safe integer', 9007199254740992],
    ['not finite', Infinity],
  ])('reports a size that is %s', (_label: string, size: unknown) => {
    expect(checkReleaseManifest(manifestOf({ ...fileAt('index.mjs'), size }))).toEqual([
      {
        code: 'file-size-invalid',
        path: 'files[0].size',
        message: 'files[0].size must be a whole number of bytes from 0 to 9007199254740991.',
      },
    ])
  })

  it.each([0, 9007199254740991])('accepts the size %d', (size: number) => {
    expect(checkReleaseManifest(manifestOf({ ...fileAt('index.mjs'), size }))).toEqual([])
  })

  it.each([
    ['missing', undefined],
    ['no string', 64],
    ['uppercase', 'A'.repeat(64)],
    ['too short', 'a'.repeat(63)],
    ['too long', 'a'.repeat(65)],
    ['followed by a line feed', `${SHA_A}\n`],
  ])('reports a digest that is %s', (_label: string, sha256: unknown) => {
    expect(checkReleaseManifest(manifestOf({ ...fileAt('index.mjs'), sha256 }))).toEqual([
      {
        code: 'file-sha256-invalid',
        path: 'files[0].sha256',
        message: 'files[0].sha256 must be 64 lowercase hexadecimal characters.',
      },
    ])
  })

  it('reports every problem of a document at once', () => {
    const value = {
      schema: 1,
      name: 'clock shell',
      version: 'v1',
      files: [{ path: 'b.js', size: -1, sha256: 'ff', mode: 420 }, 'a.js', { path: 'a.js', size: 1, sha256: SHA_B }],
      created: 'now',
    }
    expect(checkReleaseManifest(value).map((issue) => `${issue.code} ${issue.path}`)).toEqual([
      'member-unknown ',
      'name-invalid name',
      'version-invalid version',
      'member-unknown files[0]',
      'file-size-invalid files[0].size',
      'file-sha256-invalid files[0].sha256',
      'file-not-object files[1]',
    ])
  })

  it('reports every problem of a file list of fifty thousand entries', () => {
    const files = Array.from({ length: 50000 }, () => ({}))
    expect(checkReleaseManifest(manifestWith({ files })).length).toBe(150000)
  })

  it('never repeats a value or a key in a message', () => {
    const value = manifestWith({
      name: 'SECRET NAME',
      version: 'SECRET-VERSION',
      files: [{ path: '../SECRET', size: 'SECRET', SECRET: 1 }],
    })
    expect(checkReleaseManifest(value).filter((issue) => issue.message.includes('SECRET'))).toEqual([])
  })
})

describe('isReleasePath', () => {
  it('accepts a path of named segments', () => {
    expect(isReleasePath('assets/app.css')).toBe(true)
  })

  it.each([
    ['a segment that climbs', '../app.css'],
    ['a line feed', 'app\n.css'],
    ['a value that is no text', 7],
  ])('refuses %s', (_label: string, value: unknown) => {
    expect(isReleasePath(value)).toBe(false)
  })
})

describe('compareCodePoints', () => {
  it.each([
    ['a shorter text before one it opens', 'assets', 'assets/app.js'],
    ['an uppercase letter before a lowercase one', 'README.md', 'index.cjs'],
    ['two astral characters by their low halves', '\u{1f600}', '\u{1f601}'],
    ['two astral characters by their high halves', '\u{1f600}', '\u{1f900}'],
    ['a private use character before an astral one', '\ue000', '\u{10000}'],
  ])('orders %s', (_label: string, first: string, second: string) => {
    expect([second, first, second].sort(compareCodePoints)).toEqual([first, second, second])
  })

  it('answers zero for equal texts', () => {
    expect(compareCodePoints('index.mjs', 'index.mjs')).toBe(0)
  })
})

describe('validateReleaseManifest', () => {
  it('returns a sound manifest unchanged', () => {
    const value = manifestWith()
    expect(validateReleaseManifest(value, 'shell/hf-release.json')).toBe(value)
  })

  it('throws every problem on a line of its own under the source path', () => {
    expect(() => validateReleaseManifest(manifestWith({ name: '', files: [] }), 'shell/hf-release.json')).toThrow(
      [
        'shell/hf-release.json: invalid release manifest:',
        '  - name must be a non-empty string with no whitespace, control character or U+FFFD.',
        '  - files must list at least one file.',
      ].join('\n')
    )
  })
})

describe('serializeReleaseManifest', () => {
  it('writes two-space JSON in schema order', () => {
    const manifest: ReleaseManifest = {
      schema: 1,
      name: '@scope/clock-shell',
      version: '1.2.3',
      files: [{ path: 'index.mjs', size: 3, sha256: SHA_A }],
    }
    expect(serializeReleaseManifest(manifest)).toBe(CANONICAL)
  })

  it('serializes members in schema order whatever order the value was built in', () => {
    const shuffled = { files: [{ sha256: SHA_A, size: 3, path: 'index.mjs' }], version: '1.2.3', name: '@scope/clock-shell', schema: 1 }
    expect(serializeReleaseManifest(shuffled as ReleaseManifest)).toBe(CANONICAL)
  })

  it('ends the serialization with one line feed', () => {
    expect(serializeReleaseManifest(manifestWith() as unknown as ReleaseManifest)).toMatch(/[^\n]\n$/)
  })

  it('leaves out a member schema 1 does not define', () => {
    const extended = {
      schema: 1,
      name: '@scope/clock-shell',
      version: '1.2.3',
      files: [{ ...fileAt('index.mjs'), mode: 420 }],
      kind: 'shell',
    }
    expect(serializeReleaseManifest(extended as unknown as ReleaseManifest)).toBe(CANONICAL)
  })
})

describe('parseReleaseManifest', () => {
  it('parses its own serialization', () => {
    const manifest = manifestWith() as unknown as ReleaseManifest
    expect(parseReleaseManifest(serializeReleaseManifest(manifest), 'shell/hf-release.json')).toEqual(manifest)
  })

  it('rejects text that is not JSON', () => {
    expect(refusalOf('{ schema: 1 }')).toBe('shell/hf-release.json: invalid release manifest:\n  - the file is not JSON.')
  })

  it('rejects a file that opens with a byte order mark', () => {
    expect(refusalOf(`\ufeff${CANONICAL}`)).toBe('shell/hf-release.json: invalid release manifest:\n  - the file is not JSON.')
  })

  it('rejects JSON that is no manifest with the problems of its content', () => {
    expect(refusalOf('[]')).toBe('shell/hf-release.json: invalid release manifest:\n  - the manifest must be an object.')
  })

  it('rejects a reformatted file as not canonical', () => {
    expect(refusalOf(JSON.stringify(JSON.parse(CANONICAL)))).toBe(
      [
        'shell/hf-release.json: invalid release manifest:',
        '  - the file is not in canonical form: its bytes differ from the serialisation of its own content.',
      ].join('\n')
    )
  })

  it('rejects a duplicate key as not canonical', () => {
    expect(refusalOf(CANONICAL.replace('  "schema": 1,', '  "schema": 2,\n  "schema": 1,'))).toContain('the file is not in canonical form')
  })

  it('rejects a file with no closing line feed as not canonical', () => {
    expect(refusalOf(CANONICAL.trimEnd())).toContain('the file is not in canonical form')
  })

  it('rejects a number spelled another way as not canonical', () => {
    expect(refusalOf(CANONICAL.replace('"size": 3,', '"size": 3.0,'))).toContain('the file is not in canonical form')
  })

  it('refuses the text a lossy decode leaves of a file with a malformed byte in a path', () => {
    const bytes = Buffer.from(CANONICAL.replace('index.mjs', 'index?.mjs'), 'utf8')
    bytes[bytes.indexOf('?')] = 0xff
    expect(refusalOf(bytes.toString('utf8'))).toContain('files[0].path must be a relative path')
  })

  it('reports the content of a reformatted file ahead of its form', () => {
    expect(refusalOf('{"schema":1,"name":"","version":"1.2.3","files":[]}')).toBe(
      [
        'shell/hf-release.json: invalid release manifest:',
        '  - name must be a non-empty string with no whitespace, control character or U+FFFD.',
        '  - files must list at least one file.',
      ].join('\n')
    )
  })
})
