import { dropSections, splitTitle } from './readme-sections'

/** A package README, reduced to the parts a package page renders. */
export interface PreparedPackageReadme {
  /** The package title, taken from the README's leading heading */
  title: string | null
  /** The markdown the page renders, with the site's own sections claimed */
  body: string
}

/** The README sections the site renders somewhere other than in the document body. */
const CLAIMED_SECTION_SLUGS = ['license', 'part-of-hyperfrontend']

/**
 * Reduce a package README to what its documentation page actually shows.
 *
 * A README is portable package documentation and stays that way: nothing here
 * writes to a source file. What it does is claim the sections whose content the
 * site has a better home for, so the rendered page states each fact once.
 *
 * The leading heading becomes the page's own title rather than the first thing
 * inside the prose. `License` and `Part of hyperfrontend` go entirely: the
 * first is two words and a link that now sit under that title, and the second
 * existed only to point elsewhere, which is what the page already ends with.
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
  return { title, body: dropSections(body, CLAIMED_SECTION_SLUGS) }
}
