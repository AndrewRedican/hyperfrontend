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
