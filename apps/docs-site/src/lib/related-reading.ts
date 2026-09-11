import type { GuideIndexEntry } from '../../scripts/generate-guides.types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { getLibraryArchitecture, getManifest } from './docs-loader'
import { getGuidesForPackage } from './guides'
import { libraryRoute } from './library-routes'
import { readSection } from './readme-sections'

/**
 * What kind of destination an entry leads to, as a reader would classify it.
 *
 * This is the reader's taxonomy, not the site's plumbing: it says what will be
 * on the other side of the link, and deliberately says nothing about whether
 * the entry came from the guide corpus, a README, or this file.
 */
export type RelatedKind = 'Tutorial' | 'How-to' | 'Troubleshooting' | 'Recipe' | 'Architecture' | 'Package' | 'Getting started'

/**
 * One onward link from a package page.
 */
export interface RelatedEntry {
  /** Where it leads */
  href: string
  /** What the destination is called */
  title: string
  /** One line on what the reader will find there */
  blurb: string
  /** What kind of destination it is */
  kind: RelatedKind
}

/** What the package page needs to know to assemble its onward links. */
export interface RelatedReadingInput {
  /** Full npm package name */
  packageName: string
  /** The library's URL slug, as its page passes it */
  slug: string
  /** The package's README, after link transformation */
  readme: string
}

/** How the guide corpus's document types are labelled on a card. */
const GUIDE_KINDS: Record<GuideIndexEntry['type'], RelatedKind> = {
  tutorial: 'Tutorial',
  'how-to': 'How-to',
  troubleshooting: 'Troubleshooting',
  recipe: 'Recipe',
}

/** The anchor id of the README section that exists only to point elsewhere. */
const ONWARD_SECTION_SLUG = 'part-of-hyperfrontend'

/**
 * The two documents every package page ends by offering, because they are the
 * two questions a reader who has finished one package page most often has
 * next: how do I start, and how does this fit with the rest.
 */
const ORIENTATION: readonly RelatedEntry[] = [
  { href: '/docs', title: 'Getting Started', blurb: 'Set HyperFrontend up and embed a first feature.', kind: 'Getting started' },
  { href: '/architecture', title: 'Architecture Guide', blurb: 'How the packages fit together.', kind: 'Architecture' },
]

/**
 * Every onward link a package page offers, from every source it has, as one
 * list.
 *
 * A package page used to send readers away from three places: a fixed pair of
 * orientation cards, the guides the corpus knows about, and a README section
 * whose entire content was "this is part of a monorepo, here is the full
 * documentation, here are the neighbouring packages". All three answered the
 * same question and none of them knew about the others, so the page asked the
 * reader to notice that the same question had three answers in three shapes.
 *
 * They are one list here, ordered by how close each destination is to the
 * package the reader is already on: its own architecture document, then the
 * guides written about it, then the packages it works with, then the two
 * site-wide orientation documents. Where an entry came from is not something
 * the reader is told, because it is not something the reader can use.
 *
 * @param input - See {@link RelatedReadingInput}.
 * @param input.packageName - Full npm package name
 * @param input.slug - The library's URL slug, as its page passes it
 * @param input.readme - The package's README, after link transformation
 * @returns The onward links, nearest first
 *
 * @example Assembling the flagship's onward links
 * ```ts
 * buildRelatedReading({ packageName: '@hyperfrontend/features', slug: 'features', readme })
 * // [{ kind: 'Architecture', ... }, { kind: 'Tutorial', ... }, ...]
 * ```
 */
export function buildRelatedReading({ packageName, slug, readme }: RelatedReadingInput): RelatedEntry[] {
  const entries: RelatedEntry[] = []

  if (getLibraryArchitecture(slug)) {
    entries.push({
      href: `/docs/libraries/${slug}/architecture`,
      title: 'Architecture',
      blurb: `How ${packageName} is put together, and why.`,
      kind: 'Architecture',
    })
  }

  for (const guide of getGuidesForPackage(packageName)) {
    entries.push({ href: guide.route, title: guide.title, blurb: guide.problem, kind: GUIDE_KINDS[guide.type] })
  }

  entries.push(...relatedPackages(readme, packageName))
  entries.push(...ORIENTATION)

  return entries
}

/**
 * Read the neighbouring packages a README names in its onward section.
 *
 * The bullets there are the package author's own answer to "what else should I
 * look at", written next to the code and kept current by whoever changes it,
 * which makes them worth keeping. What is not worth keeping is the section
 * around them: a line saying the package lives in a monorepo, and a link to
 * the very page the reader is standing on.
 *
 * A bullet counts only when it names a documented package, so a link to
 * something the site does not publish is left in the README and never becomes
 * a card that leads off the site.
 *
 * @param readme - The package's README, after link transformation
 * @param packageName - The package whose page this is, so it never lists itself
 * @returns One entry per neighbouring package named, in the README's order
 */
function relatedPackages(readme: string, packageName: string): RelatedEntry[] {
  const section = readSection(readme, ONWARD_SECTION_SLUG)
  if (!section) return []

  const libraries = getManifest()?.libraries ?? []
  const byName = createMap(libraries.map((library) => [library.packageName, library]))
  const entries: RelatedEntry[] = []
  const seen = createMap<string, true>()

  for (const line of section.split('\n')) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (!bullet) continue

    const named = /\[([^\]]+)\]\(/g
    let match: RegExpExecArray | null
    while ((match = named.exec(bullet[1])) !== null) {
      const library = byName.get(match[1].trim())
      if (!library || library.packageName === packageName || seen.has(library.packageName)) continue
      seen.set(library.packageName, true)
      entries.push({
        href: libraryRoute(library.slug, library.category),
        title: library.packageName,
        blurb: flattenLinks(bullet[1]),
        kind: 'Package',
      })
    }
  }

  return entries
}

/**
 * Reduce a bullet's inline markdown to the sentence it reads as, so it can be
 * shown as a card's blurb.
 *
 * @param markdown - One list item's markdown
 * @returns The sentence, with links and code spans reduced to their text
 */
function flattenLinks(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .trim()
}
