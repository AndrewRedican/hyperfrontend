import { KEY_FEATURES_LEVEL, KEY_FEATURES_SLUG } from './key-features'
import { dropSections, enhanceSection, splitTitle } from './readme-sections'

/** Name of the slot the capability chips render into. */
export const CAPABILITIES_SLOT = 'capabilities'

/** The placeholder the prepared markdown carries where {@link CAPABILITIES_SLOT} is rendered. */
export const CAPABILITIES_PLACEHOLDER = `<div data-readme-slot="${CAPABILITIES_SLOT}"></div>`

/** Name of the slot the capability run renders into. */
export const KEY_FEATURES_SLOT = 'key-features'

/** The placeholder the prepared markdown carries where {@link KEY_FEATURES_SLOT} is rendered. */
export const KEY_FEATURES_PLACEHOLDER = `<div data-readme-slot="${KEY_FEATURES_SLOT}"></div>`

/** A package README, reduced to the parts a package page renders. */
export interface PreparedPackageReadme {
  /** The package title, taken from the README's leading heading */
  title: string | null
  /** The markdown the page renders, with the site's own sections claimed */
  body: string
}

/** What the caller has said it is able to draw for itself. */
export interface PackageReadmeClaims {
  /** Whether the page will render the key features itself */
  keyFeatures?: boolean
  /** Whether the page will render the architecture highlights itself, further down */
  architecture?: boolean
}

/** Anchor id of the README subsection the page moves to the end. */
export const ARCHITECTURE_SLUG = 'architecture-highlights'

/** Heading level the subsection sits at, under the package's opening section. */
export const ARCHITECTURE_LEVEL = 3

/** The README section whose tables the site draws as capability chips. */
const CAPABILITIES_SECTION_SLUG = 'compatibility'

/** @see {@link CAPABILITIES_SECTION_SLUG} */
const CAPABILITIES_SUBSECTION_SLUGS = ['output-formats']

/** The README sections the site renders somewhere other than in the document body. */
const CLAIMED_SECTION_SLUGS = ['license', 'part-of-hyperfrontend']

/** How the lede is wrapped: an alignment hint every markdown renderer keeps and every browser honours. */
const LEDE_OPEN = '<div align="center">'

/** @see {@link LEDE_OPEN} */
const LEDE_CLOSE = '</div>'

/** The characters a line starts with when it opens a block that is not a paragraph: a heading, a list, a quote, a table, a fence. */
const BLOCK_OPENERS = '#-*>|`•'

/**
 * Reduce a package README to what its documentation page actually shows.
 *
 * A README is portable package documentation and stays that way: nothing here
 * writes to a source file. What it does is claim three sections whose content
 * the site has a better home for, so the rendered page states each fact once.
 *
 * `Compatibility` keeps its heading and its place in the document and loses
 * only the tables, which become the capability chips; any subsection the site
 * does not model, a CDN snippet or a peer-dependency table, is left exactly
 * where the author put it. `License` and `Part of hyperfrontend` go entirely:
 * the first is two words and a link that now sit under the title, and the
 * second existed only to point elsewhere, which is what the page already ends
 * with.
 *
 * `Key Features` is claimed the same way, but only when the caller says it can
 * draw the section for itself. A README whose feature list does not follow the
 * convention is left to render as the markdown it is, and the search index
 * never claims it at all: a searcher matching on a capability should still be
 * shown the words that matched.
 *
 * Both the page and the search index run through here, so a result can never
 * deep-link a reader to a section the page no longer renders.
 *
 * @param markdown - The package README, after any link transformation
 * @param claims - What the caller will render for itself
 * @returns The title and the body the page renders
 *
 * @example What the page is left to render
 * ```ts
 * preparePackageReadme('# @scope/pkg\n\nIntro.\n\n## License\n\n[MIT](LICENSE.md)\n')
 * // { title: '@scope/pkg', body: 'Intro.' }
 * ```
 */
export function preparePackageReadme(markdown: string, claims: PackageReadmeClaims = {}): PreparedPackageReadme {
  const { title, body } = splitTitle(markdown)
  const enhanced = enhanceSection(body, CAPABILITIES_SECTION_SLUG, CAPABILITIES_PLACEHOLDER, CAPABILITIES_SUBSECTION_SLUGS)
  const withFeatures =
    claims.keyFeatures === true ? enhanceSection(enhanced, KEY_FEATURES_SLUG, KEY_FEATURES_PLACEHOLDER, [], KEY_FEATURES_LEVEL) : enhanced
  // why: the architecture note is moved rather than replaced in place, so the heading goes with it and the opening section closes on what the package does
  const withoutArchitecture =
    claims.architecture === true ? dropSections(withFeatures, [ARCHITECTURE_SLUG], ARCHITECTURE_LEVEL) : withFeatures
  return { title, body: dropSections(withoutArchitecture, CLAIMED_SECTION_SLUGS) }
}

/**
 * Centre the line a package README opens with, where it sits.
 *
 * Every package README leads with one sentence saying what the package is,
 * below its title, its badges and its showcase and above its first section.
 * On the package page that sentence is the only left-aligned thing between
 * two centred visuals, so it is wrapped in an alignment hint the markdown
 * pipeline keeps and the browser honours. The wrapper is a `div` with blank
 * lines inside, which is the one raw-HTML shape that leaves the sentence's
 * own markdown parsed, so a code span or a link in it still renders. The
 * sentence itself is not moved and not rewritten: the source README stays as
 * the author wrote it, and so does the text the search index reads.
 *
 * A document that opens with something other than a paragraph, a section
 * heading or a list, has no lede and is returned as it is.
 *
 * @param markdown - The package README's body, title removed
 * @returns The body with its opening paragraph centred
 *
 * @example Centring the sentence under the showcase
 * ```ts
 * centreLede('<p align="center"><img src="hero.gif"></p>\n\nOne line.\n\n## What is it?')
 * // '<p align="center"><img src="hero.gif"></p>\n\n<div align="center">\n\nOne line.\n\n</div>\n\n## What is it?'
 * ```
 */
export function centreLede(markdown: string): string {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => {
    const text = line.trim()
    return text !== '' && !text.startsWith('<') && !text.startsWith('![')
  })
  if (start === -1 || BLOCK_OPENERS.includes((lines[start] ?? '').trim().charAt(0))) {
    return markdown
  }
  let end = start
  while (end < lines.length && (lines[end] ?? '').trim() !== '') {
    end += 1
  }
  return [...lines.slice(0, start), LEDE_OPEN, '', ...lines.slice(start, end), '', LEDE_CLOSE, ...lines.slice(end)].join('\n')
}
