/**
 * The directory a service build writes: when it may be emptied, which files of the sources are
 * copied into it as assets, and how a failed build leaves nothing behind.
 *
 * @module executors/service/output
 */

import type { ServicePlan } from './options-check'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { copyAssets } from '@hyperfrontend/builder/package/assets'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { matchGlobPattern, readDirectoryRecursive } from '@hyperfrontend/project-scope/core'
import { refusal } from '../../runner/refusal'

/** The main a build writes. */
export const MAIN_FILE = 'main.cjs'

/** The file that states the immutable section of a build. */
export const SERVICE_MANIFEST_FILE = 'service.manifest.json'

/** The release manifest, which the kernel writes and names. */
export const RELEASE_MANIFEST_FILE = 'hf-release.json'

/** The names a build writes itself, which no asset may take. */
const WRITTEN_NAMES: readonly string[] = [MAIN_FILE, SERVICE_MANIFEST_FILE, RELEASE_MANIFEST_FILE]

// why: an antivirus or indexer may hold a handle on a file just written, which Windows answers with EBUSY or EPERM until it lets go
const REMOVAL = { recursive: true, force: true, maxRetries: 3, retryDelay: 100 } as const

/** The assets of a build, and what is wrong with the globs that name them. */
export interface CollectedAssets {
  /** The files to copy, relative to the entry module's directory with `/` separators, each once. */
  readonly files: readonly string[]
  /** One line per glob that matches nothing and per match on a name the build writes. */
  readonly problems: readonly string[]
}

/**
 * Whether a directory is a previous build of a service: it holds a release manifest that states the service's package name.
 *
 * @param directory - The directory, absolute
 * @param packageName - The package name of the service
 * @returns True when the release manifest there parses and names the package
 */
function isBuildOf(directory: string, packageName: string): boolean {
  try {
    return (parse(readFileSync(join(directory, RELEASE_MANIFEST_FILE), 'utf8')) as Record<string, unknown> | null)?.['name'] === packageName
  } catch {
    return false
  }
}

/**
 * Whether a directory could be created at a path: what exists nearest above it is a directory, not a file.
 *
 * @param directory - The path, absolute
 * @returns False when a file lies on the way to the path
 */
function reachable(directory: string): boolean {
  let above = dirname(directory)
  // why: the root of the file system exists, so the climb ends
  while (!existsSync(above)) above = dirname(above)
  return statSync(above).isDirectory()
}

/**
 * Checks that the directory a build writes holds nothing that could be someone else's: it is absent, empty, or a previous build of this service. Nothing is changed.
 *
 * @param directory - The output directory, absolute
 * @param label - The directory as messages name it
 * @param packageName - The package name of the service
 * @throws {Error} A refusal when the directory holds anything this build did not write
 *
 * @example A directory another package was built into
 * ```typescript
 * checkOutput('/repo/dist/apps/hello', 'dist/apps/hello', '@acme/hello')
 * // throws: the output directory dist/apps/hello holds something this build did not write; remove it or name another outputPath.
 * ```
 */
export function checkOutput(directory: string, label: string, packageName: string): void {
  const refused = refusal(`the output directory ${label} holds something this build did not write; remove it or name another outputPath.`)
  // why: below a file no entry can be looked up, and what the lookup throws for it differs by platform
  if (!reachable(directory)) throw refused
  const stats = lstatSync(directory, { throwIfNoEntry: false })
  if (stats !== undefined && (!stats.isDirectory() || (readdirSync(directory).length > 0 && !isBuildOf(directory, packageName))))
    throw refused
}

/**
 * Removes what the output directory of a build holds and starts it again, holding one file: a stub of the release manifest that states the package
 * name, so that a build interrupted before it wrote the real one can be built over. Call it only for a directory `checkOutput` has passed.
 *
 * @param directory - The output directory, absolute
 * @param packageName - The package name of the service
 *
 * @example Building over the previous build of the same service
 * ```typescript
 * checkOutput('/repo/dist/apps/hello', 'dist/apps/hello', '@acme/hello')
 * startOutput('/repo/dist/apps/hello', '@acme/hello')
 * // the directory now holds the stub alone
 * ```
 */
export function startOutput(directory: string, packageName: string): void {
  rmSync(directory, REMOVAL)
  mkdirSync(directory, { recursive: true })
  // why: the release manifest is written last, so until then this stub is what tells the next build that the directory is its own; a service beside it does not boot
  writeFileSync(join(directory, RELEASE_MANIFEST_FILE), stringify({ name: packageName }))
}

/**
 * Lists the regular files below a directory, hidden ones included. A link is no asset, and none is followed out of the sources.
 *
 * @param directory - The directory, absolute
 * @returns The files, relative to the directory with `/` separators, in order
 */
function filesBelow(directory: string): string[] {
  return readDirectoryRecursive(directory, { includeHidden: true })
    .filter((entry) => entry.isFile)
    .map((entry) => relative(directory, entry.path).split(sep).join(posix.sep))
    .sort()
}

/**
 * Collects the files the asset globs of a build match below the entry module's directory.
 *
 * @param source - The directory of the entry module, absolute
 * @param globs - The `assets` option
 * @returns The files, each once in the order of the globs and then by path, and a line per glob that matches nothing or matches a name the build writes
 *
 * @example The assets of a service that keeps a notice beside its routes
 * ```typescript
 * collectAssets('/repo/apps/hello/src', ['assets/**', 'missing/**'])
 * // => { files: ['assets/notice.txt'], problems: ['"assets[1]" matches no file.'] }
 * ```
 */
export function collectAssets(source: string, globs: readonly string[]): CollectedAssets {
  const candidates = globs.length > 0 ? filesBelow(source) : []
  const files = createSet<string>()
  const problems: string[] = []
  globs.forEach((glob, index) => {
    const matched = candidates.filter((file) => matchGlobPattern(file, glob))
    if (matched.length === 0) problems.push(`"assets[${index}]" matches no file.`)
    for (const file of matched) {
      // why: on a file system that ignores case, a file named Main.cjs would be copied over the main
      if (WRITTEN_NAMES.includes(file.toLowerCase())) problems.push(`"assets[${index}]" matches ${file}, a name the build writes.`)
      else files.add(file)
    }
  })
  return { files: [...files], problems }
}

/**
 * Copies the assets of a build beside its main, each at its path relative to the entry module.
 *
 * @param plan - Where the build reads and writes
 * @param files - The files to copy, relative to the entry module's directory
 *
 * @example Copying what the globs matched
 * ```typescript
 * copyServiceAssets(plan, collectAssets(plan.sourceRoot, plan.assets).files)
 * // dist/apps/hello/assets/notice.txt now holds the bytes of apps/hello/src/assets/notice.txt
 * ```
 */
export function copyServiceAssets(plan: ServicePlan, files: readonly string[]): void {
  // why: the copier hands the manifest to a condition of an asset specification, and this one states none
  if (files.length > 0) copyAssets([{ from: plan.sourceRoot, files: [...files] }], plan.outputPath, {})
}

/**
 * Removes the output of a build that failed, so a half-written directory cannot be deployed.
 *
 * @param directory - The output directory, absolute
 * @param label - The directory as messages name it
 * @returns Empty text once the directory is gone, else a line saying it could not be removed
 *
 * @example Leaving nothing of a build whose bundle failed
 * ```typescript
 * discardOutput('/repo/dist/apps/hello', 'dist/apps/hello')
 * // => '' and the directory is gone; removing an absent one is no error
 * ```
 */
export function discardOutput(directory: string, label: string): string {
  try {
    rmSync(directory, REMOVAL)
    return ''
  } catch {
    return `\nthe output directory ${label} could not be removed: it holds an unfinished build and must not be deployed.`
  }
}
