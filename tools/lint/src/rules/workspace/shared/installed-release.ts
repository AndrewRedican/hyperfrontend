/**
 * The release of a package that a project's own lock installs from the npm registry, for the
 * rules that compare what a deploy is built with against what it is served through.
 *
 * @module rules/workspace/shared/installed-release
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

const REGISTRY = 'https://registry.npmjs.org/'

/** One installed package of a lock. */
interface LockEntry {
  /** The installed version. */
  readonly version?: unknown
  /** Where it was installed from. */
  readonly resolved?: unknown
}

/** The lock entries the rules read. */
interface LockFile {
  /** The installed packages by path. */
  readonly packages?: Readonly<Record<string, LockEntry>>
}

/**
 * The release of a package a project's lock installs from the registry.
 *
 * @param directory - Where the project lives, beside its `package-lock.json`
 * @param name - The package to look up, as a manifest spells it
 * @returns The version, or null when the lock is missing, lacks the package or resolves it elsewhere
 *
 * @example Reading the release a demo was built with
 * ```typescript
 * installedRelease('/workspace/apps/demos/clock', '@hyperfrontend/features') // => '0.12.2'
 * ```
 */
export function installedRelease(directory: string, name: string): string | null {
  try {
    const lock = parse(readFileSync(join(directory, 'package-lock.json'), 'utf8')) as LockFile
    const entry = lock.packages?.[`node_modules/${name}`]
    return typeof entry?.version === 'string' && typeof entry.resolved === 'string' && entry.resolved.startsWith(REGISTRY)
      ? entry.version
      : null
  } catch {
    return null
  }
}
