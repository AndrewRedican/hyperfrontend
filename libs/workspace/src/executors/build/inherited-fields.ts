/**
 * The fields a built package takes from the workspace's root manifest. A field the root states
 * replaces the value the package's own manifest states for it, which is never built; a field
 * the root does not state is built as the package states it. The repository gains the package's
 * directory, so the published manifest says where in the repository the package lives.
 *
 * @module executors/build/inherited-fields
 */

import type { InheritFromSpec } from '@hyperfrontend/builder/models'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJson } from '../../graph/json'

/** A manifest, as far as its fields are read by name. */
type Manifest = Readonly<Record<string, unknown>>

/** A repository a manifest states in full, the form that has a place for a directory. */
interface StatedRepository {
  /** Where the repository is fetched from. */
  readonly url: string
  /** The directory of the manifest within the repository, where it is not the repository's root. */
  readonly directory?: unknown
}

/** The fields a built package takes from the workspace's root manifest wherever the root states them, whatever its own manifest states. */
export const INHERITED_FIELDS: readonly string[] = ['repository', 'bugs', 'homepage', 'author']

/** The directory of the workspace's state that holds what a build derives, one directory per project. */
const DERIVED_DIRECTORY: readonly string[] = ['.hf', 'build']

/** The file a project's derived fields are written to, under a name nothing that looks for manifests takes for a package. */
const DERIVED_FILE = 'inherited.json'

/** The segment of a path that names the directory above, which a project root inside the workspace never holds. */
const PARENT = '..'

/**
 * The directories a path names, outermost first, whichever separator it is written with.
 *
 * @param path - A relative path as a manifest or a project's configuration states it
 * @returns Its segments, without the empty ones and the dots that name the place itself; none for a value that is no text
 */
function segments(path: unknown): string[] {
  return typeof path === 'string' ? path.split(/[\\/]/).filter((segment) => segment !== '' && segment !== '.') : []
}

/**
 * Whether a value read from a manifest is a repository stated in full.
 *
 * @param value - What the manifest holds under `repository`
 * @returns True for an object whose `url` is text; false for the string shorthand, a list, null or a missing field
 */
function isStatedRepository(value: unknown): value is StatedRepository {
  return typeof value === 'object' && value !== null && typeof (value as StatedRepository).url === 'string'
}

/**
 * The repository a built package states: the root manifest's with the package's directory, in
 * POSIX form with no leading `./` and no trailing slash. A root that states a directory of its
 * own, because the workspace is not at the root of its repository, has it joined in front.
 * Where there is nothing to add, the root's value is answered itself: for a project at the
 * workspace root, for a project root that climbs through `..`, which names no directory of the
 * workspace, and for a root that states a string shorthand, no repository, or anything that is
 * not an object with a `url`.
 *
 * @param rootRepository - What the root manifest states
 * @param projectRoot - The project's directory, relative to the workspace root
 * @returns The root's repository with the directory, or the very value the root states
 *
 * @example A library, a workspace kept in a directory of its repository, and a root with no place for a directory
 * ```typescript
 * const root = { type: 'git', url: 'git+https://github.com/acme/workspace.git' }
 * packageRepository(root, 'libs/core') // => { type: 'git', url: root.url, directory: 'libs/core' }
 * packageRepository(root, 'libs\\utils\\beta') // => { type: 'git', url: root.url, directory: 'libs/utils/beta' }
 * packageRepository({ ...root, directory: 'packages/acme' }, 'libs/core') // => { ..., directory: 'packages/acme/libs/core' }
 * packageRepository(root, '.') // => root
 * packageRepository(root, '../outside') // => root
 * packageRepository('github:acme/workspace', 'libs/core') // => 'github:acme/workspace'
 * ```
 */
export function packageRepository(rootRepository: unknown, projectRoot: string): unknown {
  const own = segments(projectRoot)
  if (own.length === 0 || own.includes(PARENT) || !isStatedRepository(rootRepository)) return rootRepository
  return { ...rootRepository, directory: [...segments(rootRepository.directory), ...own].join('/') }
}

/**
 * Where the build of a project reads the inherited fields from. A project whose repository gains
 * a directory gets a source of its own, the root's fields with that repository, written under
 * the workspace's state directory: the builder stays the only writer of the built manifest. Each
 * project has its own file, so builds running side by side share none, and the file is written
 * whole and renamed into place, so nothing ever reads half of it. Where the repository gains
 * nothing, a project root that climbs out of the workspace included, the source is the root
 * manifest itself and nothing is written.
 *
 * @param workspaceRoot - The workspace root, absolute
 * @param projectRoot - The project's directory, relative to the workspace root
 * @returns The manifest to inherit from and the fields to take from it
 * @throws {Error} When the state directory of the workspace cannot be written to
 *
 * @example A library of a workspace whose root manifest states a repository in full, and the project at the root
 * ```typescript
 * inheritedFrom('/repo', 'libs/core')
 * // => { from: '/repo/.hf/build/libs/core/inherited.json', fields: ['repository', 'bugs', 'homepage', 'author'] }
 * // that file: { "repository": { "type": "git", "url": "<the root's>", "directory": "libs/core" }, "bugs": ..., ... }
 * inheritedFrom('/repo', '.')
 * // => { from: '/repo/package.json', fields: ['repository', 'bugs', 'homepage', 'author'] }
 * ```
 */
export function inheritedFrom(workspaceRoot: string, projectRoot: string): InheritFromSpec {
  const rootManifest = join(workspaceRoot, 'package.json')
  const root = readJson<Manifest>(rootManifest) ?? {}
  const repository = packageRepository(root['repository'], projectRoot)
  if (repository === root['repository']) return { from: rootManifest, fields: [...INHERITED_FIELDS] }
  const from = join(workspaceRoot, ...DERIVED_DIRECTORY, ...segments(projectRoot), DERIVED_FILE)
  mkdirSync(dirname(from), { recursive: true })
  // why: a second build of the same project may be reading the file, and a rename swaps it whole where a write in place would empty it first
  const written = `${from}.${process.pid}.tmp`
  writeFileSync(written, `${stringify(fromEntries(INHERITED_FIELDS.map((field) => [field, field === 'repository' ? repository : root[field]])), null, 2)}\n`)
  renameSync(written, from)
  return { from, fields: [...INHERITED_FIELDS] }
}
