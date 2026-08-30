import type { EcosystemLibrary } from './ecosystem'
import type { GuideIndexEntry } from './guides'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { ecosystemRank } from './ecosystem'

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
  const ranked = [...guides].sort(
    (a, b) =>
      ecosystemRank(primaryPackage(a)) - ecosystemRank(primaryPackage(b)) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.title.localeCompare(b.title)
  )

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
 * Pick the packages the landing page names before sending a reader to the
 * library index.
 *
 * Same source of truth, same reason: the few packages worth naming on the way
 * past are the few the hierarchy puts at the top, starting with the flagship.
 * A package no level names still sorts, below every placed one, so a newly
 * documented library appears in the index the moment it exists rather than
 * waiting to be added to a second list.
 *
 * @param libraries - Every documented library
 * @param limit - How many to name
 * @returns The named packages, highest altitude first
 */
export function selectFeaturedPackages(libraries: EcosystemLibrary[], limit: number): EcosystemLibrary[] {
  return [...libraries].sort((a, b) => ecosystemRank(a.packageName) - ecosystemRank(b.packageName)).slice(0, limit)
}
