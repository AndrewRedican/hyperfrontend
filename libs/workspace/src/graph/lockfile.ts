/**
 * The versions installed in the workspace, read off `package-lock.json`: each top-level
 * package's, and the versions installed below another package.
 *
 * @module graph/lockfile
 */

import { join, posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readJson } from './workspace'

/** One installed package of the lock file. */
interface LockEntry {
  /** The installed version. */
  readonly version?: string
}

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
