import type { ReleaseFileSystem } from '../manifest/release-files'
import type { ServiceBuildStamp } from './run-build'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createReleaseManifest } from '../manifest/release-files'
import { serializeReleaseManifest } from '../manifest/release-format'
import { BUILD_KEY, checkRelease, freezeDeep, immutableDigest, readStamp, sealServiceBuild } from './run-build'

const DIRECTORY = join('srv', 'hello')
const MANIFEST = join(DIRECTORY, 'hf-release.json')
const SECTION_DIGEST = 'a'.repeat(64)
const STAMP: ServiceBuildStamp = { directory: DIRECTORY, immutable: SECTION_DIGEST }
const MALFORMED = { issues: ['  - the build stamp is malformed.'], fields: {}, release: '', immutable: '' }
const UNREADABLE = { issues: ['  - hf-release.json could not be read.'], fields: {}, release: '', immutable: SECTION_DIGEST }
const MARKER = 'section-marker'

/** A release held in memory, and the file system a check reads it through. */
interface MemoryRelease {
  /** The bytes of every file by its full path, the manifest among them; a case changes them to break the release. */
  readonly contents: Map<string, Uint8Array>
  /** Every call the check made: the function, then the path it was given. */
  readonly calls: string[][]
  /** The file system handed to the check. */
  readonly files: Required<ReleaseFileSystem>
}

/**
 * Hashes bytes with an implementation that is not the one under test.
 *
 * @param bytes - The bytes, or a text hashed as UTF-8.
 * @returns The SHA-256 as 64 lowercase hexadecimal characters.
 */
const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')

/**
 * Builds a sound release of two files in memory, with the manifest that describes them.
 *
 * @returns The release, which a case alters before it is checked.
 */
const memoryRelease = (): MemoryRelease => {
  const contents = new Map<string, Uint8Array>([
    [join(DIRECTORY, 'main.cjs'), Buffer.from("'use strict';\n")],
    [join(DIRECTORY, 'assets', 'notice.txt'), Buffer.from('notice\n')],
  ])
  const calls: string[][] = []
  const files: Required<ReleaseFileSystem> = {
    list: (root) => {
      calls.push(['list', root])
      return [...contents.keys()].map((path) => ({ path: path.slice(root.length + 1), kind: 'file' }))
    },
    read: (path) => {
      calls.push(['read', path])
      const bytes = contents.get(path)
      if (bytes === undefined) {
        throw Object.assign(new Error(`no file at ${path}`), { code: 'ENOENT' })
      }
      return bytes
    },
    size: (path) => {
      calls.push(['size', path])
      return contents.get(path)?.length ?? null
    },
  }
  const manifest = createReleaseManifest({ root: DIRECTORY, name: 'hello', version: '1.0.0' }, files)
  contents.set(MANIFEST, Buffer.from(serializeReleaseManifest(manifest)))
  calls.length = 0
  return { contents, calls, files }
}

/**
 * Raises a fixed error for a getter that must not be read.
 */
const refuse = (): never => {
  throw new Error('a getter that throws')
}

describe('sealServiceBuild', () => {
  it('gives the statement that stamps a CommonJS main, with the digest in it', () => {
    const digest = sha256('{"a":1}')
    expect(sealServiceBuild({ a: 1 }).statement).toBe(
      `globalThis[Symbol.for("@hyperfrontend/server/service-build")] = Object.freeze({ directory: __dirname, immutable: "${digest}" });`
    )
  })

  it('gives the digest an independent hash gives for the text of the section', () => {
    expect(sealServiceBuild({ a: 1 }).digest).toBe(sha256('{"a":1}'))
  })

  it('gives the text the stamp is registered under', () => {
    expect(sealServiceBuild(null).key).toBe('@hyperfrontend/server/service-build')
  })

  it('registers the stamp under the text its reader looks it up by', () => {
    expect(sealServiceBuild(null).key).toBe(BUILD_KEY)
  })

  it('gives a frozen result', () => {
    expect(Object.isFrozen(sealServiceBuild({ a: 1 }))).toBe(true)
  })

  it('writes a statement that leaves a frozen stamp where the reader finds it', () => {
    const seal = sealServiceBuild({ greeting: 'Hello' })
    const stamp = runInNewContext(`${seal.statement}; globalThis[Symbol.for(${JSON.stringify(seal.key)})]`, { __dirname: DIRECTORY })
    expect({ directory: stamp.directory, immutable: stamp.immutable, frozen: Object.isFrozen(stamp), members: Object.keys(stamp) }).toEqual(
      {
        directory: DIRECTORY,
        immutable: seal.digest,
        frozen: true,
        members: ['directory', 'immutable'],
      }
    )
  })

  it('writes a statement that holds no path', () => {
    expect(sealServiceBuild({ a: 1 }).statement).not.toContain(process.cwd())
  })

  it.each([
    ['undefined', undefined],
    ['a function', () => MARKER],
    ['a BigInt', 10n],
    ['a symbol', Symbol(MARKER)],
  ])('throws the fixed TypeError for %s', (_name, value) => {
    expect(() => sealServiceBuild(value)).toThrow(new TypeError('sealServiceBuild: the immutable section must be a JSON value.'))
  })

  it('throws the fixed TypeError for a section that holds a number that is not finite', () => {
    expect(() => sealServiceBuild({ maxBodyBytes: NaN })).toThrow(
      new TypeError('sealServiceBuild: the immutable section must be a JSON value.')
    )
  })

  it('throws the fixed TypeError for a cycle', () => {
    const cycle: Record<string, unknown> = { name: MARKER }
    cycle['self'] = cycle
    expect(() => sealServiceBuild(cycle)).toThrow(new TypeError('sealServiceBuild: the immutable section must be a JSON value.'))
  })

  it('throws the fixed TypeError for a section that holds a BigInt, with nothing of the section in the message', () => {
    expect(() => sealServiceBuild({ name: MARKER, count: 10n })).toThrow(
      new TypeError('sealServiceBuild: the immutable section must be a JSON value.')
    )
  })
})

describe('immutableDigest', () => {
  it('is the SHA-256 of the JSON text, with no indentation and no line feed', () => {
    expect(immutableDigest({ greeting: 'Hello', punctuation: ['!', '?'] })).toBe(sha256('{"greeting":"Hello","punctuation":["!","?"]}'))
  })

  it('hashes the text as UTF-8', () => {
    expect(immutableDigest('café')).toBe(sha256(Buffer.from('"café"', 'utf8')))
  })

  it('is equal for equal trees', () => {
    expect(immutableDigest({ limits: { names: 3 }, list: [1, 2] })).toBe(immutableDigest({ limits: { names: 3 }, list: [1, 2] }))
  })

  it('differs when two keys swap places', () => {
    expect(immutableDigest({ a: 1, b: 2 })).not.toBe(immutableDigest({ b: 2, a: 1 }))
  })

  it('differs when a nested array changes', () => {
    expect(immutableDigest({ list: [1, [2, 3]] })).not.toBe(immutableDigest({ list: [1, [3, 2]] }))
  })

  it('survives a round trip through JSON', () => {
    const section = { greeting: 'Hello', limits: { names: 3 }, nothing: null }
    expect(immutableDigest(JSON.parse(JSON.stringify(section, null, 2)))).toBe(immutableDigest(section))
  })

  it.each([
    ['undefined', undefined],
    ['a function', () => 1],
    ['a BigInt', 10n],
    ['a member that is Infinity', { maxBodyBytes: Infinity }],
    ['a member that is NaN', { maxBodyBytes: NaN }],
    ['a member that is undefined', { debug: undefined }],
    ['a member that is a function', { hook: () => 1 }],
    ['a member that is a symbol', { mark: Symbol('mark') }],
    ['an element that is undefined', { list: [1, undefined] }],
  ])('gives none for %s', (_name, value) => {
    expect(immutableDigest(value)).toBeNull()
  })

  it('gives none for a cycle', () => {
    const cycle: Record<string, unknown> = {}
    cycle['self'] = cycle
    expect(immutableDigest(cycle)).toBeNull()
  })
})

describe('readStamp', () => {
  it('gives the value under the registered symbol', () => {
    expect(readStamp({ [Symbol.for(BUILD_KEY)]: STAMP })).toBe(STAMP)
  })

  it('gives undefined when nothing is registered', () => {
    expect(readStamp({ [BUILD_KEY]: STAMP })).toBeUndefined()
  })
})

describe('checkRelease', () => {
  const temp = useTempDir()

  describe('the stamp', () => {
    it.each([
      ['a string', DIRECTORY],
      ['null', null],
      ['undefined', undefined],
      ['an empty directory', { directory: '', immutable: SECTION_DIGEST }],
      ['a directory that is no text', { directory: 5, immutable: SECTION_DIGEST }],
      ['a digest of 63 characters', { directory: DIRECTORY, immutable: 'a'.repeat(63) }],
      ['a digest of 65 characters', { directory: DIRECTORY, immutable: 'a'.repeat(65) }],
      ['an upper-case digest', { directory: DIRECTORY, immutable: 'A'.repeat(64) }],
      ['a digest that is no text', { directory: DIRECTORY, immutable: 64 }],
      ['no digest', { directory: DIRECTORY }],
    ])('is malformed as %s', (_name, stamp) => {
      expect(checkRelease(stamp, memoryRelease().files)).toEqual(MALFORMED)
    })

    it('is malformed when it cannot be read', () => {
      const stamp = Object.defineProperty({ immutable: SECTION_DIGEST }, 'directory', { get: refuse })
      expect(checkRelease(stamp, memoryRelease().files)).toEqual(MALFORMED)
    })

    it('reads no file when it is malformed', () => {
      const release = memoryRelease()
      checkRelease({ directory: DIRECTORY }, release.files)
      expect(release.calls).toEqual([])
    })

    it('is accepted without a prototype when it is well formed', () => {
      const stamp = Object.assign(Object.create(null), STAMP)
      expect(checkRelease(stamp, memoryRelease().files).issues).toEqual([])
    })
  })

  describe('the manifest', () => {
    it('is read once, as bytes, from the directory of the stamp', () => {
      const release = memoryRelease()
      checkRelease(STAMP, release.files)
      expect(release.calls.filter(([name, path]) => name === 'read' && path === MANIFEST)).toEqual([['read', MANIFEST]])
    })

    it('reports a read that throws, and nothing of what was thrown', () => {
      const release = memoryRelease()
      release.contents.delete(MANIFEST)
      expect(checkRelease(STAMP, release.files)).toEqual(UNREADABLE)
    })

    it('does not open a manifest that is no regular file', () => {
      const release = memoryRelease()
      checkRelease(STAMP, { ...release.files, size: (path) => (path === MANIFEST ? null : release.files.size(path)) })
      expect(release.calls.filter(([name]) => name === 'read')).toEqual([])
    })

    it('reports a manifest that is no regular file as one that could not be read', () => {
      const release = memoryRelease()
      expect(checkRelease(STAMP, { ...release.files, size: () => null })).toEqual(UNREADABLE)
    })

    it('reads the manifest of a directory on disk with no file system given', () => {
      temp.write('main.cjs', "'use strict';\n")
      const manifest = serializeReleaseManifest(createReleaseManifest({ root: temp.path, name: 'hello', version: '1.0.0' }))
      temp.write('hf-release.json', manifest)
      expect(checkRelease({ directory: temp.path, immutable: SECTION_DIGEST }).release).toBe(sha256(manifest))
    })

    it('prints a fixed number of lines for a manifest with many problems, then how many more there are', () => {
      const release = memoryRelease()
      release.contents.set(MANIFEST, Buffer.from(JSON.stringify({ schema: 1, name: 'x', version: '1.0.0', files: Array(100).fill({}) })))
      expect(checkRelease(STAMP, release.files).issues.slice(31)).toEqual([
        '  - files[10].path must be a relative path with "/" separators and no empty, "." or ".." segment, backslash, control character or U+FFFD.',
        '  - and 269 more.',
      ])
    })

    it('reports a file the disk does not hold, read with no file system given', () => {
      expect(checkRelease({ directory: temp.resolve('absent'), immutable: SECTION_DIGEST })).toEqual(UNREADABLE)
    })

    it('reports bytes that are not UTF-8', () => {
      const release = memoryRelease()
      release.contents.set(MANIFEST, Uint8Array.of(0x7b, 0xff, 0xfe, 0x7d))
      expect(checkRelease(STAMP, release.files)).toEqual(UNREADABLE)
    })

    it('passes on the lines of the validator for a file that is not canonical', () => {
      const release = memoryRelease()
      release.contents.set(MANIFEST, Buffer.from(`${Buffer.from(release.files.read(MANIFEST)).toString('utf8')}\n`))
      expect(checkRelease(STAMP, release.files)).toEqual({
        issues: [
          'hf-release.json: invalid release manifest:',
          '  - the file is not in canonical form: its bytes differ from the serialisation of its own content.',
        ],
        fields: {},
        release: '',
        immutable: SECTION_DIGEST,
      })
    })

    it('refuses a file that opens with a byte order mark', () => {
      const release = memoryRelease()
      release.contents.set(MANIFEST, Buffer.concat([Uint8Array.of(0xef, 0xbb, 0xbf), release.files.read(MANIFEST)]))
      expect(checkRelease(STAMP, release.files).issues).toEqual(['hf-release.json: invalid release manifest:', '  - the file is not JSON.'])
    })

    it('verifies nothing once the manifest is refused', () => {
      const release = memoryRelease()
      release.contents.set(MANIFEST, Buffer.from('{}'))
      checkRelease(STAMP, release.files)
      expect(release.calls).toEqual([
        ['size', MANIFEST],
        ['read', MANIFEST],
      ])
    })
  })

  describe('the directory', () => {
    it('is sound when it holds exactly the listed bytes', () => {
      const release = memoryRelease()
      expect(checkRelease(STAMP, release.files)).toEqual({
        issues: [],
        fields: {},
        release: sha256(release.files.read(MANIFEST)),
        immutable: SECTION_DIGEST,
      })
    })

    it('is identified by the digest of the manifest bytes that were read', () => {
      const release = memoryRelease()
      expect(checkRelease(STAMP, release.files).release).toBe(sha256(release.contents.get(MANIFEST) as Uint8Array))
    })

    it('is verified through the file system that was given, from the directory of the stamp', () => {
      const release = memoryRelease()
      checkRelease(STAMP, release.files)
      expect(release.calls).toEqual(
        expect.arrayContaining([
          ['list', DIRECTORY],
          ['size', join(DIRECTORY, 'main.cjs')],
          ['read', join(DIRECTORY, 'main.cjs')],
        ])
      )
    })

    it('lists every difference as one line, in the order the verification gives them', () => {
      const release = memoryRelease()
      release.contents.set(join(DIRECTORY, 'main.cjs'), Buffer.from("'use strict';;"))
      release.contents.set(join(DIRECTORY, 'extra.txt'), Buffer.from('one more'))
      expect(checkRelease(STAMP, release.files)).toEqual({
        issues: ['  - main.cjs does not have the listed SHA-256.', '  - extra.txt is present but not listed.'],
        fields: {},
        release: '',
        immutable: SECTION_DIGEST,
      })
    })

    it('writes an unlisted name that holds a line break as one list item', () => {
      const release = memoryRelease()
      release.contents.set(join(DIRECTORY, 'x\nfatal cause=environment'), Buffer.from('forged'))
      expect(checkRelease(STAMP, release.files).issues).toEqual(['  - "x\\nfatal cause=environment" is present but not listed.'])
    })

    it('prints a fixed number of differences, then how many more there are', () => {
      const release = memoryRelease()
      Array.from({ length: 40 }, (_, index) => release.contents.set(join(DIRECTORY, `extra${index}.txt`), Buffer.from('one more')))
      expect(checkRelease(STAMP, release.files).issues.slice(31)).toEqual(['  - extra37.txt is present but not listed.', '  - and 8 more.'])
    })

    it('reports a verification that throws by the name and the code of what it threw', () => {
      const release = memoryRelease()
      const list = (): never => {
        throw Object.assign(new RangeError(`cannot list ${MARKER}`), { code: 'EIO' })
      }
      expect(checkRelease(STAMP, { ...release.files, list })).toEqual({
        issues: ['  - the release could not be read.'],
        fields: { name: 'RangeError', code: 'EIO' },
        release: '',
        immutable: SECTION_DIGEST,
      })
    })
  })
})

describe('freezeDeep', () => {
  it('freezes an object, the object inside it and the array inside that', () => {
    const section = freezeDeep({ limits: { names: [1, { deep: true }] } })
    expect([section, section.limits, section.limits.names, section.limits.names[1]].map((value) => Object.isFrozen(value))).toEqual([
      true,
      true,
      true,
      true,
    ])
  })

  it('returns the value it was given', () => {
    const section = { greeting: 'Hello' }
    expect(freezeDeep(section)).toBe(section)
  })

  it.each(['one value', 7, true, null, undefined])('returns %j as it is', (value) => {
    expect(freezeDeep(value)).toBe(value)
  })

  it('ends on a cycle', () => {
    const cycle: Record<string, unknown> = { name: 'loop' }
    cycle['self'] = { back: cycle }
    expect(Object.isFrozen((freezeDeep(cycle)['self'] as Record<string, unknown>)['back'])).toBe(true)
  })

  it('does not descend into a value that is already frozen', () => {
    const inner = { open: true }
    freezeDeep(Object.freeze({ inner }))
    expect(Object.isFrozen(inner)).toBe(false)
  })

  it('leaves a value that is neither a plain object nor an array as it found it', () => {
    const bytes = new Uint8Array(4)
    const date = new Date(0)
    freezeDeep({ bytes, date })
    expect([Object.isFrozen(bytes), Object.isFrozen(date)]).toEqual([false, false])
  })

  it('freezes an object that has no prototype', () => {
    expect(Object.isFrozen(freezeDeep(Object.assign(Object.create(null), { a: 1 })))).toBe(true)
  })
})
