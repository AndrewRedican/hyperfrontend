import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The libraries a batch versions. */
export interface SelectedLibraries {
  /** The verdict discriminator. */
  ok: true
  /** The libraries to version, once each and sorted. */
  libraries: readonly string[]
}

/** A request the batch refuses. */
export interface RefusedSelection {
  /** The verdict discriminator. */
  ok: false
  /** Why, phrased as the fix. */
  reason: string
}

/** The libraries a batch versions, or why the request was refused. */
export type LibrarySelection = SelectedLibraries | RefusedSelection

/**
 * Decide which libraries a batch versions.
 *
 * An ordinary batch versions the affected libraries and nothing else. A forced
 * bump is different in kind: it releases packages whose commits would not have
 * released them, so it must name them, and it may not lean on affected
 * detection, which would sweep in every library a docs commit touched.
 *
 * @param named - The libraries named on the command line, or undefined for none.
 * @param releaseAs - The forced bump, or undefined for none.
 * @param affected - The libraries affected detection found.
 * @param isVersionable - Whether a project declares a version target.
 * @returns The libraries to version, or the reason the request was refused.
 * @example Forcing a patch on two libraries
 * ```ts
 * selectLibraries(['lib-logging', 'lib-nexus'], 'patch', [], (name) => name.startsWith('lib-'))
 * // { ok: true, libraries: ['lib-logging', 'lib-nexus'] }
 * ```
 */
export function selectLibraries(
  named: readonly string[] | undefined,
  releaseAs: string | undefined,
  affected: readonly string[],
  isVersionable: (project: string) => boolean
): LibrarySelection {
  if (named === undefined && releaseAs === undefined) {
    return { ok: true, libraries: affected }
  }
  if (named === undefined || named.length === 0) {
    return {
      ok: false,
      reason: 'A forced bump names the libraries it applies to: pass --libraries=<project,...> together with --releaseAs.',
    }
  }
  if (releaseAs === undefined) {
    return { ok: false, reason: '--libraries is only meaningful with --releaseAs; an ordinary batch versions every affected library.' }
  }
  const unknown = named.filter((name) => !isVersionable(name))
  if (unknown.length > 0) {
    return { ok: false, reason: `Not versionable: ${unknown.join(', ')}. Name projects that declare a version target.` }
  }
  return { ok: true, libraries: from(createSet(named)).sort() }
}
