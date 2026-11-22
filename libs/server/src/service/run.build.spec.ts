import type { ReleaseFileSystem } from '../manifest/release-files'
import type { ServiceClock } from './clock'
import type { ProcessOutput, RunDeps, ServiceDefinition } from './run'
import type { ServiceBuildStamp } from './run-build'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { describe, expect, flushPromises, it } from '@hyperfrontend/testing'
import { createReleaseManifest } from '../manifest/release-files'
import { serializeReleaseManifest } from '../manifest/release-format'
import { runService } from './run'

const DIRECTORY = join('srv', 'hello')
const MANIFEST = join(DIRECTORY, 'hf-release.json')
const SECTION = { greeting: 'Hello', limits: { names: [3, 5] } }
const KEY = Symbol.for('@hyperfrontend/server/service-build')
const DIFFERS_BLOCK = 'fatal cause=immutable\n  - the immutable section this service runs with is not the one it was built with.\n'

/** The fake process: it records what the runner writes and asks. */
interface FakeProcess extends EventEmitter {
  /** The environment the contract is checked against. */
  env: Record<string, string | undefined>
  /** The platform name. */
  platform: string
  /** Everything written to standard output, in order. */
  out: string
  /** Everything written to standard error, in order. */
  err: string
  /** Every code `exit` was called with. */
  exits: number[]
  /** Standard output. */
  stdout: ProcessOutput
  /** Standard error. */
  stderr: ProcessOutput
  /** Records the code instead of ending anything. */
  exit(code: number): void
}

/** A release held in memory, and the file system a boot reads it through. */
interface MemoryRelease {
  /** The bytes of every file by its full path, the manifest among them; a case changes them to break the release. */
  readonly contents: Map<string, Uint8Array>
  /** Every call the boot made: the function, then the path it was given. */
  readonly calls: string[][]
  /** The file system handed to the runner. */
  readonly files: Required<ReleaseFileSystem>
}

/** One boot over the fakes. */
interface Boot {
  /** The fake process. */
  readonly proc: FakeProcess
  /** What the definition's functions were called with, in order: `check`, `load`, `start`. */
  readonly calls: string[]
  /** The release the boot read. */
  readonly release: MemoryRelease
}

/**
 * Hashes bytes with an implementation that is not the one under test.
 *
 * @param bytes - The bytes, or a text hashed as UTF-8.
 * @returns The SHA-256 as 64 lowercase hexadecimal characters.
 */
const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')

/**
 * Writes the stamp a build of a section would leave.
 *
 * @param section - The immutable section the service was built with.
 * @returns The stamp, for the directory of the release in memory.
 */
const stampOf = (section: unknown): ServiceBuildStamp => ({ directory: DIRECTORY, immutable: sha256(JSON.stringify(section)) })

/**
 * Builds a fake process whose streams call back at once.
 *
 * @returns An event emitter with the members the runner uses.
 */
const fakeProcess = (): FakeProcess => {
  const proc: FakeProcess = Object.assign(new EventEmitter(), {
    env: {},
    platform: 'linux',
    out: '',
    err: '',
    exits: [] as number[],
    stdout: { write: (text: string, done?: () => void) => ((proc.out += text), done?.()) },
    stderr: { write: (text: string, done?: () => void) => ((proc.err += text), done?.()) },
    exit: (code: number) => void proc.exits.push(code),
  })
  return proc
}

const clock: ServiceClock = { now: () => 0, setTimeout: () => 0, clearTimeout: () => undefined }

/**
 * Builds a sound release of two files in memory, with the manifest that describes them.
 *
 * @returns The release, which a case alters before it is booted from.
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
  contents.set(
    MANIFEST,
    Buffer.from(serializeReleaseManifest(createReleaseManifest({ root: DIRECTORY, name: 'hello', version: '1.0.0' }, files)))
  )
  calls.length = 0
  return { contents, calls, files }
}

/**
 * Boots a service over fakes and lets its start settle.
 *
 * @param members - What the case adds to a definition that boots.
 * @param deps - The build stamp and whatever else the case injects; the files default to a sound release in memory.
 * @param release - The release the boot reads, already altered by the case.
 * @returns The fake process, the calls made to the definition, and the release.
 */
const boot = async (members: Record<string, unknown>, deps: RunDeps, release: MemoryRelease = memoryRelease()): Promise<Boot> => {
  const proc = fakeProcess()
  const calls: string[] = []
  const definition = {
    environment: { check: () => (calls.push('check'), []), load: () => (calls.push('load'), {}) },
    start: () => (calls.push('start'), { port: 8080, close: async () => undefined }),
    ...members,
  } as unknown as ServiceDefinition<Record<string, never>>
  void runService(definition, { process: proc, clock, files: release.files, ...deps })
  await flushPromises()
  return { proc, calls, release }
}

/**
 * Raises a fixed error for a getter that must not be read.
 */
const refuse = (): never => {
  throw new Error('a getter that throws')
}

describe('runService, the build check', () => {
  describe('from source', () => {
    it('reads no file', async () => {
      const { release } = await boot({ immutable: SECTION }, { build: null })
      expect(release.calls).toEqual([])
    })

    it('prints a started line with no release', async () => {
      const { proc } = await boot({ immutable: SECTION }, { build: null })
      expect(proc.out).toBe('started port=8080\n')
    })

    it('runs from source when no stamp is given and none is registered', async () => {
      const { proc } = await boot({}, {})
      expect(proc.out).toBe('started port=8080\n')
    })
  })

  describe('a sound release', () => {
    it('prints the digest of its manifest in the started line', async () => {
      const { proc, release } = await boot({ immutable: SECTION }, { build: stampOf(SECTION) })
      expect(proc.out).toBe(`started port=8080 release=${sha256(release.contents.get(MANIFEST) as Uint8Array)}\n`)
    })

    it('boots a definition that has no section, without comparing one', async () => {
      const { proc, release } = await boot({}, { build: stampOf(SECTION) })
      expect(proc.out).toBe(`started port=8080 release=${sha256(release.contents.get(MANIFEST) as Uint8Array)}\n`)
    })

    it('is checked before the environment and before start', async () => {
      const { calls } = await boot({ immutable: SECTION }, { build: stampOf(SECTION) })
      expect(calls).toEqual(['check', 'load', 'start'])
    })

    it('takes its stamp from the global object when none is given', async () => {
      const holder = globalThis as Record<symbol, unknown>
      holder[KEY] = stampOf(SECTION)
      try {
        const { proc } = await boot({ immutable: SECTION }, {})
        expect(proc.out).toMatch(/^started port=8080 release=[0-9a-f]{64}\n$/)
      } finally {
        delete holder[KEY]
      }
    })
  })

  describe('a release that is refused', () => {
    it('reports a malformed stamp', async () => {
      const { proc } = await boot({}, { build: { directory: '', immutable: 'a'.repeat(64) } })
      expect(proc.err).toBe('fatal cause=release\n  - the build stamp is malformed.\n')
    })

    it('reports a manifest that cannot be read', async () => {
      const release = memoryRelease()
      release.contents.delete(MANIFEST)
      const { proc } = await boot({}, { build: stampOf(SECTION) }, release)
      expect(proc.err).toBe('fatal cause=release\n  - hf-release.json could not be read.\n')
    })

    it('passes on what the validator says of a manifest that is not canonical', async () => {
      const release = memoryRelease()
      release.contents.set(MANIFEST, Buffer.concat([release.files.read(MANIFEST), Buffer.from('\n')]))
      const { proc } = await boot({}, { build: stampOf(SECTION) }, release)
      expect(proc.err).toBe(
        'fatal cause=release\nhf-release.json: invalid release manifest:\n  - the file is not in canonical form: its bytes differ from the serialisation of its own content.\n'
      )
    })

    it('lists a file that changed and a file that is not listed', async () => {
      const release = memoryRelease()
      release.contents.set(join(DIRECTORY, 'main.cjs'), Buffer.from("'use strict';;"))
      release.contents.set(join(DIRECTORY, 'extra.txt'), Buffer.from('one more'))
      const { proc } = await boot({}, { build: stampOf(SECTION) }, release)
      expect(proc.err).toBe(
        'fatal cause=release\n  - main.cjs does not have the listed SHA-256.\n  - extra.txt is present but not listed.\n'
      )
    })

    it('reports a verification that throws by its name and its code, and nothing of its message', async () => {
      const release = memoryRelease()
      const list = (): never => {
        throw Object.assign(new RangeError(`cannot list ${DIRECTORY}`), { code: 'EIO' })
      }
      const { proc } = await boot({}, { build: stampOf(SECTION), files: { ...release.files, list } }, release)
      expect(proc.err).toBe('fatal cause=release name=RangeError code=EIO\n  - the release could not be read.\n')
    })

    it('exits 78, prints no started line and never checks the environment', async () => {
      const release = memoryRelease()
      release.contents.set(join(DIRECTORY, 'extra.txt'), Buffer.from('one more'))
      const { proc, calls } = await boot({}, { build: stampOf(SECTION) }, release)
      expect({ exits: proc.exits, out: proc.out, calls }).toEqual({ exits: [78], out: '', calls: [] })
    })

    it('leaves no listener behind', async () => {
      const { proc } = await boot({}, { build: 'not a stamp' as unknown as ServiceBuildStamp })
      expect(proc.eventNames()).toEqual([])
    })
  })

  describe('the immutable section', () => {
    it('refuses a section that is not the one the service was built with', async () => {
      const { proc } = await boot({ immutable: { ...SECTION, greeting: 'Goodbye' } }, { build: stampOf(SECTION) })
      expect(proc.err).toBe(DIFFERS_BLOCK)
    })

    it('refuses a section whose keys were reordered', async () => {
      const { proc } = await boot({ immutable: { limits: SECTION.limits, greeting: SECTION.greeting } }, { build: stampOf(SECTION) })
      expect(proc.err).toBe(DIFFERS_BLOCK)
    })

    it.each([
      ['a function', () => 'Hello'],
      ['a BigInt', 10n],
    ])('refuses a section that is %s, which JSON cannot represent', async (_name, immutable) => {
      const { proc } = await boot({ immutable }, { build: stampOf(SECTION) })
      expect(proc.err).toBe(DIFFERS_BLOCK)
    })

    it('exits 78, prints no started line and never checks the environment', async () => {
      const { proc, calls } = await boot({ immutable: 'another' }, { build: stampOf(SECTION) })
      expect({ exits: proc.exits, out: proc.out, calls }).toEqual({ exits: [78], out: '', calls: [] })
    })

    it('reports the release first when both are wrong', async () => {
      const release = memoryRelease()
      release.contents.set(join(DIRECTORY, 'extra.txt'), Buffer.from('one more'))
      const { proc } = await boot({ immutable: 'another' }, { build: stampOf(SECTION) }, release)
      expect(proc.err).toBe('fatal cause=release\n  - extra.txt is present but not listed.\n')
    })
  })

  describe('freeze', () => {
    it('freezes the section deep when the service runs from source', async () => {
      const immutable = { greeting: 'Hello', limits: { names: [3, 5] } }
      await boot({ immutable }, { build: null })
      expect([immutable, immutable.limits, immutable.limits.names].map((value) => Object.isFrozen(value))).toEqual([true, true, true])
    })

    it('freezes the section deep when the service is built', async () => {
      const immutable = { greeting: 'Hello', limits: { names: [3, 5] } }
      await boot({ immutable }, { build: stampOf(SECTION) })
      expect([immutable, immutable.limits, immutable.limits.names].map((value) => Object.isFrozen(value))).toEqual([true, true, true])
    })

    it('has frozen the section by the time start runs', async () => {
      const immutable = { greeting: 'Hello' }
      const seen: boolean[] = []
      await boot({ immutable, start: () => (seen.push(Object.isFrozen(immutable)), { close: async () => undefined }) }, { build: null })
      expect(seen).toEqual([true])
    })

    it.each([
      ['an accessor of the section throws', { limits: Object.defineProperty({}, 'names', { get: refuse, enumerable: true }) }],
      ['the section nests deeper than the stack', Array.from({ length: 20000 }).reduce<unknown>((inner) => ({ inner }), {})],
    ])('exits 1 with a definition block when %s, from source', async (_name, immutable) => {
      const { proc } = await boot({ immutable }, { build: null })
      expect({ exits: proc.exits, err: proc.err.replace(/name=\w+/, 'name=') }).toEqual({
        exits: [1],
        err: 'fatal cause=definition name=\n',
      })
    })

    it('leaves no listener behind when an accessor of the section throws', async () => {
      const immutable = { limits: Object.defineProperty({}, 'names', { get: refuse, enumerable: true }) }
      const { proc } = await boot({ immutable }, { build: null })
      expect(proc.eventNames()).toEqual([])
    })

    it('names what the accessor threw and nothing of its message', async () => {
      const immutable = { limits: Object.defineProperty({}, 'names', { get: refuse, enumerable: true }) }
      const { proc } = await boot({ immutable }, { build: null })
      expect(proc.err).toBe('fatal cause=definition name=Error\n')
    })

    it('answers a built service whose section has no digest with the section block', async () => {
      const { proc } = await boot({ immutable: { maxBodyBytes: Infinity } }, { build: stampOf({ maxBodyBytes: Infinity }) })
      expect({ exits: proc.exits, err: proc.err }).toEqual({ exits: [78], err: DIFFERS_BLOCK })
    })

    it('leaves the section as it was when the release is refused', async () => {
      const immutable = { greeting: 'Hello' }
      await boot({ immutable }, { build: { directory: '', immutable: 'a'.repeat(64) } })
      expect(Object.isFrozen(immutable)).toBe(false)
    })
  })
})
