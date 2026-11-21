/**
 * What a `package-lock.json` installs: the version of each top-level package of the workspace and
 * the versions installed below another package, and the packages a lock file takes from a
 * registry.
 *
 * @module graph/lockfile
 */

import { join, posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readJson } from './json'

/** One installed package of the lock file. */
interface LockEntry {
  /** The installed version. */
  readonly version?: string
  /** Where the package was fetched from: a registry address, a `file:` path, or the directory a link points at. */
  readonly resolved?: string
  /** Whether the entry links a directory in place of installing a package. */
  readonly link?: boolean
}

/** The path of a package installed at the top level starts with this. */
const TOP_LEVEL = 'node_modules/'

/** The address of a package a registry serves. */
const REGISTRY_ADDRESS = /^https?:\/\//

/** The lock file, as far as the versions are read. */
interface LockFile {
  /** The installed packages by their path under the workspace. */
  readonly packages?: Readonly<Record<string, LockEntry>>
}

/** The installed versions, as the lock file records them. */
export interface InstalledPackages {
  /** The version of each package installed at the top level, by name. */
  readonly hoisted: Map<string, string>
  /** Each `name@version` installed below another package. */
  readonly nested: Set<string>
}

/**
 * The installed versions of a workspace.
 *
 * @param root - The workspace root, absolute
 * @returns The top-level versions and the nested ones; empty without a lock file
 *
 * @example A package installed twice at different versions
 * ```typescript
 * const { hoisted, nested } = installedPackages(root)
 * hoisted.get('minimatch') // => '10.0.1', from node_modules/minimatch
 * nested.has('minimatch@3.1.2') // => true, from node_modules/typedoc/node_modules/minimatch
 * hoisted.get('@hyperfrontend/features') // => undefined, workspace links carry no version
 * ```
 */
export function installedPackages(root: string): InstalledPackages {
  const hoisted = createMap<string, string>()
  const nested = createSet<string>()
  const lock = readJson<LockFile>(join(root, 'package-lock.json'))
  const marker = `node_modules${posix.sep}`
  for (const [path, entry] of entries(lock?.packages ?? {})) {
    const last = path.lastIndexOf(marker)
    if (last === -1 || entry.version === undefined) continue
    const name = path.slice(last + marker.length)
    if (last === 0) hoisted.set(name, entry.version)
    else nested.add(`${name}@${entry.version}`)
  }
  return { hoisted, nested }
}

/**
 * The packages a lock file installs from a registry at its top level, where an import of the
 * directory beside it finds them. A package installed from a tarball on disk, a linked directory
 * and a package installed below another are left out.
 *
 * @param lockFile - The lock file, absolute
 * @returns The package names, in the order the lock file lists them; none without a lock file
 *
 * @example Only what a registry serves counts
 * ```typescript
 * // "node_modules/@acme/data": { "version": "1.0.0", "resolved": "https://registry.npmjs.org/@acme/data/-/data-1.0.0.tgz" }
 * // "node_modules/@acme/shell": { "version": "0.1.0", "resolved": "file:vendor/acme-shell-0.1.0.tgz" }
 * // "node_modules/@acme/linked": { "resolved": "../../libs/linked", "link": true }
 * registryInstalls(join(root, 'apps/site/package-lock.json')) // => Set { '@acme/data' }
 * ```
 */
export function registryInstalls(lockFile: string): Set<string> {
  const names = createSet<string>()
  for (const [path, entry] of entries(readJson<LockFile>(lockFile)?.packages ?? {})) {
    if (path.lastIndexOf(TOP_LEVEL) === 0 && entry.link !== true && REGISTRY_ADDRESS.test(entry.resolved ?? ''))
      names.add(path.slice(TOP_LEVEL.length))
  }
  return names
}
