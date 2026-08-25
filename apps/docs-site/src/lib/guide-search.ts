import type { GuideIndexEntry } from '../../scripts/generate-guides.types'
import { GUIDE_TYPE_GROUPS } from './guide-labels'
import { normalize, tokenize } from './search/search-engine'

/**
 * Relevance tiers, in priority order. A guide scores by the most specific
 * text its reader's words all appear in, so a title hit always outranks a
 * package or keyword hit, which outranks a hit anywhere else in the guide.
 */
const RELEVANCE = { title: 3, facets: 2, content: 1 }

/**
 * The normalized text one guide is matched against, widening tier by tier.
 */
interface GuideHaystack {
  /** The guide title */
  title: string
  /** The classifying vocabulary: document type, the packages involved, and the authored keywords */
  facets: string
  /** Everything the index knows: the title, the facets, the problem and outcome statements, and every section heading */
  content: string
}

/**
 * Build the normalized text one guide is matched against.
 *
 * Section headings stand in for the guide body: they name what a guide covers
 * without the corpus index having to carry its prose.
 *
 * @param guide - The guide to index for matching
 * @returns The guide's haystack, one entry per relevance tier
 */
function buildGuideHaystack(guide: GuideIndexEntry): GuideHaystack {
  // why: Normalizing collapses the scope and the hyphen, so '@hyperfrontend/nexus' answers 'nexus' and 'how-to' answers 'how to'; the plural chip label is what catches 'tutorials'
  const chips = GUIDE_TYPE_GROUPS.filter((group) => group.value === guide.type).map((group) => group.chip)
  const facets = [guide.type, ...chips, ...guide.packages, ...guide.keywords]

  return {
    title: normalize(guide.title),
    facets: normalize(facets.join(' ')),
    content: normalize([guide.title, ...facets, guide.problem, guide.outcome, ...guide.headings].join(' ')),
  }
}

/**
 * Score one guide against a reader's query tokens.
 *
 * @param guide - The guide to score
 * @param tokens - Normalized query tokens; every one must appear in a tier for that tier to match
 * @returns The matched tier's weight, or 0 when the guide does not match at all
 */
function scoreGuide(guide: GuideIndexEntry, tokens: string[]): number {
  const haystack = buildGuideHaystack(guide)

  if (tokens.every((token) => haystack.title.includes(token))) {
    return RELEVANCE.title
  }
  if (tokens.every((token) => haystack.facets.includes(token))) {
    return RELEVANCE.facets
  }
  if (tokens.every((token) => haystack.content.includes(token))) {
    return RELEVANCE.content
  }
  return 0
}

/**
 * Narrow a guide corpus to the ones a reader's words match, most relevant
 * first.
 *
 * Matching is exact substring over normalized text with AND semantics, the
 * same contract the site-wide search honors: every token must appear, and
 * there is no fuzziness. Guides matching at the same tier keep the order they
 * arrived in, so whatever the caller already sorted by survives as the
 * tiebreak.
 *
 * @param guides - The guides to search, in the order they would otherwise be listed
 * @param query - The reader's raw words; a blank or punctuation-only query narrows nothing
 * @returns The matching guides, most relevant first, or the input untouched when there is nothing to match
 *
 * @example Search a package's guides for the problem a reader described
 * ```ts
 * searchGuides(getGuidesForPackage('@hyperfrontend/nexus'), 'cross window')
 * ```
 */
export function searchGuides(guides: GuideIndexEntry[], query: string): GuideIndexEntry[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) {
    return guides
  }

  return guides
    .map((guide, position) => ({ guide, position, score: scoreGuide(guide, tokens) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map((scored) => scored.guide)
}
