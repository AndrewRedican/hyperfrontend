/**
 * The difference between a package as it would be packed now and as the registry holds it: the
 * files added, removed and changed, and the lines a report prints for them.
 *
 * @module artifact-drift/compare
 */

import { compareText } from '../graph/order'
import { contentHash } from './pack'

/** How a local pack differs from the published one. */
export interface Drift {
  /** The package name. */
  readonly name: string
  /** The version compared. */
  readonly version: string
  /** The content hash of the local pack. */
  readonly local: string
  /** The content hash of the published tarball. */
  readonly published: string
  /** The files only the local pack holds. */
  readonly added: readonly string[]
  /** The files only the published tarball holds. */
  readonly removed: readonly string[]
  /** The files both hold with different content. */
  readonly changed: readonly string[]
}

/**
 * Compares a local pack with the published tarball.
 *
 * @param name - The package name
 * @param version - The version compared
 * @param local - Each local path to its content hash
 * @param published - Each published path to its content hash
 * @returns The drift
 */
export function compareArtifacts(
  name: string,
  version: string,
  local: ReadonlyMap<string, string>,
  published: ReadonlyMap<string, string>
): Drift {
  const added = [...local.keys()].filter((path) => !published.has(path)).sort(compareText)
  const removed = [...published.keys()].filter((path) => !local.has(path)).sort(compareText)
  const changed = [...local]
    .filter(([path, hash]) => published.has(path) && published.get(path) !== hash)
    .map(([path]) => path)
    .sort(compareText)
  return { name, version, local: contentHash(local), published: contentHash(published), added, removed, changed }
}

/**
 * Whether a drift shows no difference.
 *
 * @param drift - The comparison result
 * @returns True when the packs agree
 */
export function isIdentical(drift: Drift): boolean {
  return drift.added.length === 0 && drift.removed.length === 0 && drift.changed.length === 0
}

/**
 * The lines a report prints for one drift.
 *
 * @param drift - The comparison result
 * @returns One heading, then one line per differing file
 */
export function renderDrift(drift: Drift): string[] {
  const head = `${drift.name}@${drift.version}: ${isIdentical(drift) ? 'identical to the registry' : 'differs from the registry'} (local ${drift.local.slice(0, 12)}, published ${drift.published.slice(0, 12)})`
  return [
    head,
    ...drift.added.map((path) => `  + ${path}`),
    ...drift.removed.map((path) => `  - ${path}`),
    ...drift.changed.map((path) => `  ~ ${path}`),
  ]
}
