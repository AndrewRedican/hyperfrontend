import type { FileTree } from '@hyperfrontend/testing/fs'
import type { ReleaseListing, ServiceKernel } from './kernel'
import { existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { loadKernel, releaseProblems } from './kernel'

const REFUSAL =
  'hello is built on @hyperfrontend/server 0.2.0 or later, which is not installed where its sources resolve it: npm install @hyperfrontend/server'

/**
 * The text of a fake root entry of the kernel.
 *
 * @param statement - The statement its seal gives, which tells one fake from another
 * @returns The module's text, exporting by name
 */
function rootEntry(statement = 'seal;'): string {
  return `exports.sealServiceBuild = () => ({ statement: '${statement}', digest: 'digest', key: 'key' })\n`
}

const ROOT_ENTRY = rootEntry()

const MANIFEST_ENTRY = [
  "exports.createReleaseManifest = () => 'create'",
  "exports.serializeReleaseManifest = () => 'serialize'",
  "exports.releaseManifestDigest = () => 'digest'",
  "exports.verifyRelease = () => 'verify'",
  '',
].join('\n')

/**
 * The files of a fake kernel package.
 *
 * @param at - The directory holding `node_modules`, from the workspace root
 * @param root - The text of the root entry
 * @param manifest - The text of the manifest entry
 * @returns The tree
 */
function kernelAt(at: string, root: string, manifest: string = MANIFEST_ENTRY): FileTree {
  return {
    [`${at}/node_modules/@hyperfrontend/server/index.cjs`]: root,
    [`${at}/node_modules/@hyperfrontend/server/manifest.cjs`]: manifest,
  }
}

const workspace = useTempDir({ prefix: 'service-kernel-', tree: { 'apps/hello/package.json': { name: '@fixture/hello' } } })

/**
 * Finds an entry of the fake kernel the way a module resolves a package: beside the project first, then at the workspace root.
 * The process the specs run in resolves the kernel's name to this repository's sources, so the lookup is the spec's own.
 *
 * @param from - The project's directory
 * @param specifier - The entry
 * @returns The entry's file, or null when neither directory installs it
 */
function resolveOnDisk(from: string, specifier: string): string | null {
  const entry = specifier.endsWith('/manifest') ? 'manifest.cjs' : 'index.cjs'
  return (
    [from, workspace.path]
      .map((directory) => join(directory, 'node_modules/@hyperfrontend/server', entry))
      .find((file) => existsSync(file)) ?? null
  )
}

/**
 * Loads the kernel of the service at `apps/hello` from the disk.
 *
 * @returns What each of the five functions answers, by name
 */
async function loaded(): Promise<Record<string, unknown>> {
  const kernel = await loadKernel('hello', join(workspace.path, 'apps/hello'), resolveOnDisk, (file) => import(pathToFileURL(file).href))
  return {
    seal: kernel.sealServiceBuild({}).statement,
    create: kernel.createReleaseManifest({ root: '', name: '', version: '' }),
    serialize: kernel.serializeReleaseManifest({}),
    digest: kernel.releaseManifestDigest(''),
    verify: kernel.verifyRelease('', {}),
  }
}

/**
 * The message loading the kernel of the service at `apps/hello` rejects with.
 *
 * @returns The message, or empty text when the kernel loaded
 */
async function refused(): Promise<string> {
  try {
    await loaded()
    return ''
  } catch (error) {
    return (error as Error).message
  }
}

describe('loadKernel', () => {
  it('loads the five functions of a CommonJS kernel', async () => {
    workspace.writeTree(kernelAt('.', ROOT_ENTRY))
    expect(await loaded()).toEqual({ seal: 'seal;', create: 'create', serialize: 'serialize', digest: 'digest', verify: 'verify' })
  })

  it('reads a function from the default export when the namespace does not name it', async () => {
    workspace.writeTree(
      kernelAt(
        '.',
        "module.exports = Object.freeze({ sealServiceBuild: () => ({ statement: 'from default;', digest: 'digest', key: 'key' }) })\n"
      )
    )
    expect((await loaded())['seal']).toBe('from default;')
  })

  it("asks for the kernel from the project's directory, where its own node_modules comes before the workspace's", async () => {
    workspace.writeTree({ ...kernelAt('.', ROOT_ENTRY), ...kernelAt('apps/hello', rootEntry('project;')) })
    expect((await loaded())['seal']).toBe('project;')
  })

  it('refuses a project whose sources do not resolve the kernel', async () => {
    expect(await refused()).toBe(REFUSAL)
  })

  it('refuses a kernel whose manifest entry does not resolve', async () => {
    workspace.write('node_modules/@hyperfrontend/server/index.cjs', ROOT_ENTRY)
    expect(await refused()).toBe(REFUSAL)
  })

  it('refuses a kernel that lacks a function the build calls', async () => {
    workspace.writeTree(kernelAt('.', "exports.startService = () => 'an earlier kernel'\n"))
    expect(await refused()).toBe(REFUSAL)
  })

  it('refuses a kernel whose function is no function', async () => {
    workspace.writeTree(kernelAt('.', ROOT_ENTRY, MANIFEST_ENTRY.replace("() => 'verify'", "'verify'")))
    expect(await refused()).toBe(REFUSAL)
  })
})

describe('the kernel loadKernel answers', () => {
  it.each([
    ['no statement', "{ digest: 'digest', key: 'key' }"],
    ['an empty statement', "{ statement: '', digest: 'digest', key: 'key' }"],
    ['no digest', "{ statement: 'seal;', key: 'key' }"],
    ['a key that is no text', "{ statement: 'seal;', digest: 'digest', key: 7 }"],
    ['nothing', 'undefined'],
  ])('refuses a seal with %s, which would check nothing', async (_, seal) => {
    workspace.writeTree(kernelAt('.', `exports.sealServiceBuild = () => (${seal})\n`))
    expect(await refused()).toBe(REFUSAL)
  })
})

describe('releaseProblems', () => {
  const INPUT = { root: '/repo/dist/apps/hello', name: '@fixture/hello', version: '1.2.3' }

  /**
   * A kernel whose manifest writer answers as the given function does.
   *
   * @param createReleaseManifest - What indexing a release does
   * @returns The kernel, its other functions absent
   */
  function kernelThat(createReleaseManifest: ServiceKernel['createReleaseManifest']): ServiceKernel {
    return { createReleaseManifest } as ServiceKernel
  }

  it('finds no problem where the kernel indexes the release', () => {
    expect(
      releaseProblems(
        kernelThat(() => ({})),
        INPUT,
        ['main.cjs']
      )
    ).toEqual([])
  })

  it('hands the kernel the files the build is to write, with the separators of the platform', () => {
    const listed: string[] = []
    releaseProblems(
      kernelThat((input, listing) =>
        listed.push(...(listing as ReleaseListing).list(input.root).map((entry) => `${entry.kind} ${entry.path}`))
      ),
      INPUT,
      ['main.cjs', 'assets/notice.txt']
    )
    expect(listed).toEqual(['file main.cjs', `file assets${sep}notice.txt`])
  })

  it('hands the kernel no bytes of a file that does not exist yet', () => {
    const read: number[] = []
    releaseProblems(
      kernelThat((_input, listing) => read.push((listing as ReleaseListing).read('main.cjs').length)),
      INPUT,
      ['main.cjs']
    )
    expect(read).toEqual([0])
  })

  it('lists what the kernel refuses, without the line that names the manifest file', () => {
    const refusing = kernelThat(() => {
      throw createError(
        '/repo/dist/apps/hello/hf-release.json: invalid release manifest:\n  - version must be a semantic version.\n  - name must be a non-empty string.'
      )
    })
    expect(releaseProblems(refusing, INPUT, ['main.cjs'])).toEqual([
      'version must be a semantic version.',
      'name must be a non-empty string.',
    ])
  })

  it('passes a refusal of one line on whole', () => {
    const refusing = kernelThat(() => {
      throw createError('the directory holds no file.')
    })
    expect(releaseProblems(refusing, INPUT, [])).toEqual(['the directory holds no file.'])
  })
})
