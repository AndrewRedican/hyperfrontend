import type { EcosystemLibrary } from './ecosystem'
import type { GuideIndexEntry } from './guides'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { ecosystemRank, FLAGSHIP_PACKAGE } from './ecosystem'

/**
 * How many guides one package may contribute before the rest of the hierarchy
 * gets its turn.
 *
 * Without a cap the flagship's own guides would take every slot, which is the
 * right emphasis carried to the wrong conclusion: a first-time reader should
 * see that the SDK leads and that there is something underneath it, in the
 * space of four cards.
 */
const MAX_GUIDES_PER_PACKAGE = 2

/** Editorial priority as a sort key, best first. */
const PRIORITY_RANK: Record<GuideIndexEntry['priority'], number> = { P0: 0, P1: 1, P2: 2 }

/**
 * The package a guide is primarily about, which is the first one it lists.
 *
 * @param guide - A compiled guide's index entry
 * @returns The owning package name, empty when the guide names none
 */
function primaryPackage(guide: GuideIndexEntry): string {
  return guide.packages[0] ?? ''
}

/**
 * Order guides by the altitude of the package each one is about.
 *
 * The flagship SDK's material leads, then the levels beneath it in order;
 * editorial priority orders a level's own guides, and the title settles the
 * rest. This is the one order every landing surface reads guides in, so a
 * shelf that shows a whole small corpus and one that features a few of a
 * large one agree about what comes first.
 *
 * @param guides - Guide index entries in any order
 * @returns The same entries, highest altitude first
 *
 * @example Ordering the tutorials
 * ```typescript
 * rankGuidesByAltitude(getGuideIndex().filter((guide) => guide.type === 'tutorial'))
 * ```
 */
export function rankGuidesByAltitude(guides: GuideIndexEntry[]): GuideIndexEntry[] {
  return [...guides].sort(
    (a, b) =>
      ecosystemRank(primaryPackage(a)) - ecosystemRank(primaryPackage(b)) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.title.localeCompare(b.title)
  )
}

/**
 * Pick the guides the landing page opens with.
 *
 * The landing page is the site's most valuable navigation, so what it offers
 * first is decided by the package hierarchy rather than by whichever guides
 * happen to sort first: the flagship SDK's material leads, then the levels
 * beneath it in order. Editorial priority orders a level's own guides, the
 * title settles the rest, and no package may fill the band on its own.
 *
 * @param guides - Every compiled guide's index entry
 * @param limit - How many to feature
 * @returns The featured guides, highest altitude first
 *
 * @example Featuring four entry points
 * ```typescript
 * selectFeaturedGuides(getGuideIndex(), 4).map((guide) => guide.packages[0])
 * // ['@hyperfrontend/features', '@hyperfrontend/features', '@hyperfrontend/nexus', '@hyperfrontend/builder']
 * ```
 */
export function selectFeaturedGuides(guides: GuideIndexEntry[], limit: number): GuideIndexEntry[] {
  const ranked = rankGuidesByAltitude(guides)

  const takenPerPackage = createMap<string, number>()
  const featured: GuideIndexEntry[] = []
  for (const guide of ranked) {
    if (featured.length >= limit) break
    const owner = primaryPackage(guide)
    const taken = takenPerPackage.get(owner) ?? 0
    if (taken >= MAX_GUIDES_PER_PACKAGE) continue
    takenPerPackage.set(owner, taken + 1)
    featured.push(guide)
  }

  return featured
}

/**
 * Order the published packages the way the landing page names them: the
 * flagship first, then by how often the world has installed each one.
 *
 * The flagship leads whatever its count says, because the strip exists to
 * show where to start; after it the download history is the honest order,
 * since it reports what readers actually reached for rather than what the
 * hierarchy would like them to. A package with no history yet sorts below
 * every package that has one, and ties fall back to the hierarchy. Packages
 * withheld from the registry are not on npm and so are not named here.
 *
 * @param libraries - Every documented library
 * @param totals - Tracked downloads by package name
 * @returns The published packages, flagship first and then most installed first
 *
 * @example Naming the strip
 * ```typescript
 * orderPackagesByDownloads(getAllLibraryData(), totals).map((library) => library.packageName)
 * // ['@hyperfrontend/features', '@hyperfrontend/versioning', '@hyperfrontend/project-scope', ...]
 * ```
 */
export function orderPackagesByDownloads(libraries: EcosystemLibrary[], totals: ReadonlyMap<string, number>): EcosystemLibrary[] {
  const downloadsOf = (library: EcosystemLibrary): number => totals.get(library.packageName) ?? -1
  return libraries
    .filter((library) => !library.isPrivate)
    .sort((a, b) => {
      if (a.packageName === FLAGSHIP_PACKAGE) return -1
      if (b.packageName === FLAGSHIP_PACKAGE) return 1
      return downloadsOf(b) - downloadsOf(a) || ecosystemRank(a.packageName) - ecosystemRank(b.packageName)
    })
}
