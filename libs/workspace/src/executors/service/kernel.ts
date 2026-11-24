/**
 * The kernel a service is built on, as the build needs it: the copy the service's own sources
 * resolve, read by the names of five functions and typed here by their shape alone, so the
 * workspace package depends on no kernel.
 *
 * @module executors/service/kernel
 */

import { posix, sep } from 'node:path'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { uint8ArrayOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'
import { refusal } from '../../runner/refusal'

/** What sealing a build gives: the statement that stamps the main, and what the stamp is known by. */
export interface ServiceSeal {
  /** One JavaScript statement for the top of the CommonJS main, after a `'use strict'` directive. */
  readonly statement: string
  /** The digest of the immutable section. */
  readonly digest: string
  /** The text the stamp is registered under, which the runner's own code holds. */
  readonly key: string
}

/** One difference between a directory and its release manifest. */
export interface ReleaseIssue {
  /** The difference in a sentence, which opens with the path of the file. */
  readonly message: string
}

/** What a release manifest is made from. */
export interface ReleaseInput {
  /** The directory to index. */
  readonly root: string
  /** The name of the artifact. */
  readonly name: string
  /** The version of the artifact. */
  readonly version: string
}

/** One entry a release is indexed from. */
export interface ReleaseListingEntry {
  /** The path below the root, with the separators of the platform. */
  readonly path: string
  /** What the entry is; a release holds regular files only. */
  readonly kind: 'file'
}

/** A stand-in for the disk a release is indexed from. */
export interface ReleaseListing {
  /** Lists the files below a root. */
  readonly list: (root: string) => readonly ReleaseListingEntry[]
  /** Reads the bytes of a file. */
  readonly read: (path: string) => Uint8Array
}

/** The functions of the kernel a service build calls. */
export interface ServiceKernel {
  /** Seals a build with the immutable section the service is built with. */
  readonly sealServiceBuild: (immutable: unknown) => ServiceSeal
  /** Indexes a directory as a release, or the listing given in its place. */
  readonly createReleaseManifest: (input: ReleaseInput, listing?: ReleaseListing) => unknown
  /** Writes a release manifest in its canonical form. */
  readonly serializeReleaseManifest: (manifest: unknown) => string
  /** Computes the identity of a release from the text of its manifest. */
  readonly releaseManifestDigest: (serialized: string) => string
  /** Holds a directory to a release manifest. */
  readonly verifyRelease: (root: string, manifest: unknown) => readonly ReleaseIssue[]
}

/** Finds the file a module specifier names, as a module in a directory resolves it. */
export type ResolveModule = (from: string, specifier: string) => string | null

/** Imports a module by its file. */
export type ImportModule = (file: string) => Promise<unknown>

/** The kernel's package. */
const KERNEL = '@hyperfrontend/server'

/** The functions read from the kernel's root entry. */
const ROOT_FUNCTIONS = ['sealServiceBuild'] as const

/** The functions read from the kernel's manifest entry. */
const MANIFEST_FUNCTIONS = ['createReleaseManifest', 'serializeReleaseManifest', 'releaseManifestDigest', 'verifyRelease'] as const

/** A module as it is imported: its named exports and, for a CommonJS build, what it assigned to `module.exports`. */
interface ModuleNamespace {
  /** A named export. */
  readonly [name: string]: unknown
  /** What a CommonJS module assigned to `module.exports`. */
  readonly default?: Readonly<Record<string, unknown>>
}

/**
 * Reads functions of one entry of the kernel by name.
 *
 * @param from - The directory the service's sources resolve the kernel from, absolute
 * @param specifier - The entry
 * @param names - The functions to read
 * @param resolve - Finds the entry's file
 * @param importModule - Imports the file
 * @returns The functions by name, or null when the entry does not resolve or lacks one of them
 */
async function functionsOf<Name extends string>(
  from: string,
  specifier: string,
  names: readonly Name[],
  resolve: ResolveModule,
  importModule: ImportModule
): Promise<Record<Name, unknown> | null> {
  const file = resolve(from, specifier)
  if (file === null) return null
  const namespace = (await importModule(file)) as ModuleNamespace
  // why: a CommonJS build is imported as a default export, with named exports only where Node could read them from its text
  const members: Readonly<Record<string, unknown>> = { ...namespace.default, ...namespace }
  const found = names.map((name) => [name, members[name]] as const)
  return found.every(([, value]) => typeof value === 'function') ? (fromEntries(found) as Record<Name, unknown>) : null
}

/**
 * Loads the kernel a service is built on: the copy its own sources resolve, which is the copy the bundle inlines.
 *
 * @param project - The project's name
 * @param projectRoot - The project's directory, absolute
 * @param resolve - Finds the file a specifier names, as a module in a directory resolves it
 * @param importModule - Imports a file
 * @returns The five functions of the kernel the build calls
 * @throws {Error} A refusal when an entry of the kernel does not resolve from the project or lacks a function the build calls; the kernel it answers refuses, the same way, a seal that is not three non-empty texts
 *
 * @example Sealing a build with the kernel the service installs
 * ```typescript
 * import { pathToFileURL } from 'node:url'
 * import { resolveFromWorkspace } from '../shared/workspace'
 *
 * const kernel = await loadKernel('hello', '/repo/apps/hello', resolveFromWorkspace, (file) => import(pathToFileURL(file).href))
 * kernel.sealServiceBuild({ greeting: 'Hello' }).digest // => 64 hexadecimal characters
 * ```
 */
export async function loadKernel(
  project: string,
  projectRoot: string,
  resolve: ResolveModule,
  importModule: ImportModule
): Promise<ServiceKernel> {
  const root = await functionsOf(projectRoot, KERNEL, ROOT_FUNCTIONS, resolve, importModule)
  const manifest = await functionsOf(projectRoot, `${KERNEL}/manifest`, MANIFEST_FUNCTIONS, resolve, importModule)
  const unusable = refusal(
    `${project} is built on ${KERNEL} 0.2.0 or later, which is not installed where its sources resolve it: npm install ${KERNEL}`
  )
  if (root === null || manifest === null) throw unusable
  const kernel = { ...root, ...manifest } as ServiceKernel
  return {
    ...kernel,
    sealServiceBuild: (immutable) => {
      const seal: Partial<ServiceSeal> | null | undefined = kernel.sealServiceBuild(immutable)
      // why: the build looks for the key in the bundle and writes the statement into it, so a seal without them would check nothing
      if (![seal?.statement, seal?.digest, seal?.key].every((member) => typeof member === 'string' && member !== '')) throw unusable
      return seal as ServiceSeal
    },
  }
}

/**
 * Asks the kernel whether a release can be written under a name and a version with a set of files, before any of them exists.
 * The rules are the kernel's own, so they cannot drift from the copy the service is bundled with.
 *
 * @param kernel - The kernel the service is built on
 * @param input - The name and the version the release is to state
 * @param files - The files the build is to write, relative to the output directory with `/` separators
 * @returns What the kernel refuses, one line each; none when the release can be written
 *
 * @example A version no release manifest can hold
 * ```typescript
 * releaseProblems(kernel, { root: '/repo/dist/apps/hello', name: '@acme/hello', version: '1.0' }, ['main.cjs', 'service.manifest.json'])
 * // => ['version must be a semantic version such as 1.2.3, with no leading "v".']
 * ```
 */
export function releaseProblems(kernel: ServiceKernel, input: ReleaseInput, files: readonly string[]): readonly string[] {
  try {
    kernel.createReleaseManifest(input, {
      list: () => files.map((file) => ({ path: file.split(posix.sep).join(sep), kind: 'file' })),
      read: () => uint8ArrayOf(),
    })
    return []
  } catch (error) {
    const lines = (error as Error).message.split(/\r?\n/)
    // why: the first line of the kernel's error names a manifest file that does not exist yet, and the lines after it say what is wrong
    return (lines.length > 1 ? lines.slice(1) : lines).map((line) => line.replace(/^\s*-\s/, ''))
  }
}
