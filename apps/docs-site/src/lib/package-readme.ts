import { dropSections, enhanceSection, splitTitle } from './readme-sections'

/** Name of the slot the capability chips render into. */
export const CAPABILITIES_SLOT = 'capabilities'

/** The placeholder the prepared markdown carries where {@link CAPABILITIES_SLOT} is rendered. */
export const CAPABILITIES_PLACEHOLDER = `<div data-readme-slot="${CAPABILITIES_SLOT}"></div>`

/** A package README, reduced to the parts a package page renders. */
export interface PreparedPackageReadme {
  /** The package title, taken from the README's leading heading */
  title: string | null
  /** The markdown the page renders, with the site's own sections claimed */
  body: string
}

/** The README section whose tables the site draws as capability chips. */
const CAPABILITIES_SECTION_SLUG = 'compatibility'

/** @see {@link CAPABILITIES_SECTION_SLUG} */
const CAPABILITIES_SUBSECTION_SLUGS = ['output-formats']

/** The README sections the site renders somewhere other than in the document body. */
const CLAIMED_SECTION_SLUGS = ['license', 'part-of-hyperfrontend']

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
 * Both the page and the search index run through here, so a result can never
 * deep-link a reader to a section the page no longer renders.
 *
 * @param markdown - The package README, after any link transformation
 * @returns The title and the body the page renders
 *
 * @example What the page is left to render
 * ```ts
 * preparePackageReadme('# @scope/pkg\n\nIntro.\n\n## License\n\n[MIT](LICENSE.md)\n')
 * // { title: '@scope/pkg', body: 'Intro.' }
 * ```
 */
export function preparePackageReadme(markdown: string): PreparedPackageReadme {
  const { title, body } = splitTitle(markdown)
  const enhanced = enhanceSection(body, CAPABILITIES_SECTION_SLUG, CAPABILITIES_PLACEHOLDER, CAPABILITIES_SUBSECTION_SLUGS)
  return { title, body: dropSections(enhanced, CLAIMED_SECTION_SLUGS) }
}
