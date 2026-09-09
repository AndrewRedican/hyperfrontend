import type { PackageFacts } from '../../scripts/package-facts.types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { getManifest } from './docs-loader'

export type {
  EnvironmentId,
  EnvironmentSupport,
  OutputFormatId,
  PackageCompatibility,
  PackageFacts,
  PackageOutput,
} from '../../scripts/package-facts.types'

/** Where a published package is browsed, without a trailing slash. */
const NPM_REGISTRY = 'https://www.npmjs.com/package'

/** Facts by package name, built once for the life of the build. */
let factsCache: Map<string, PackageFacts> | null = null

/**
 * Index the manifest's package facts by npm package name.
 *
 * @returns Facts for every documented package
 */
function factsByPackage(): Map<string, PackageFacts> {
  if (factsCache) return factsCache

  const libraries = getManifest()?.libraries ?? []
  factsCache = createMap(
    libraries.map((library): [string, PackageFacts] => [
      library.packageName,
      {
        license: library.license ?? '',
        version: library.version ?? '',
        isPrivate: library.isPrivate ?? false,
        compatibility: library.compatibility ?? null,
        outputs: library.outputs ?? [],
      },
    ])
  )
  return factsCache
}

/**
 * What a package states about itself: its version, its licence, where it runs,
 * and what it publishes.
 *
 * Read from the documentation manifest, which copies the values straight out
 * of the package's own `package.json` and `project.json`. Nothing here is
 * written down twice, so a page cannot fall behind a release or a change to a
 * build target.
 *
 * @param packageName - Full npm package name
 * @returns The package's facts, or null when the manifest does not cover it
 *
 * @example Reading the version a page should show
 * ```ts
 * getPackageFacts('@hyperfrontend/nexus')?.version // '3.0.0'
 * ```
 */
export function getPackageFacts(packageName: string): PackageFacts | null {
  return factsByPackage().get(packageName) ?? null
}

/**
 * The registry page for the exact version a package currently exposes.
 *
 * A package withheld from the registry, or one whose manifest carries no
 * version, has no such page: the caller gets null and shows the version
 * without pretending there is somewhere to follow it to. Building the URL from
 * the same value the badge displays is the point, so the link can never point
 * at a different release from the one named beside it.
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
