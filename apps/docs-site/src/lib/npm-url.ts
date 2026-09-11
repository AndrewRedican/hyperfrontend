import type { PackageFacts } from '../../scripts/package-facts.types'

/** Where a published package is browsed, without a trailing slash. */
const NPM_REGISTRY = 'https://www.npmjs.com/package'

/**
 * The registry page for the exact version a package currently exposes.
 *
 * A package withheld from the registry, or one whose manifest carries no
 * version, has no such page: the caller gets null and shows the version
 * without pretending there is somewhere to follow it to. Building the URL from
 * the same value the badge displays is the point, so the link can never point
 * at a different release from the one named beside it.
 *
 * This lives apart from the manifest reader so that anything with a version in
 * hand can reach it. The library index builds its cards before a page renders
 * and the package pages build their badges while one does, and both have to
 * arrive at the same URL for the same release.
 *
 * @param facts - The package's facts
 * @param packageName - Full npm package name
 * @returns The version-specific npm URL, or null when the package is not published
 *
 * @example Linking a released version
 * ```ts
 * npmVersionUrl({ version: '3.0.0', isPrivate: false } as PackageFacts, '@hyperfrontend/nexus')
 * // 'https://www.npmjs.com/package/@hyperfrontend/nexus/v/3.0.0'
 * ```
 */
export function npmVersionUrl(facts: PackageFacts, packageName: string): string | null {
  if (facts.isPrivate || facts.version === '') return null
  return `${NPM_REGISTRY}/${packageName}/v/${facts.version}`
}

/**
 * The registry page for a package, with no version pinned.
 *
 * @param packageName - Full npm package name
 * @returns The registry page for the package's latest release
 */
export function npmPackageUrl(packageName: string): string {
  return `${NPM_REGISTRY}/${packageName}`
}
