import { dropSections } from './readme-sections'

/** The README sections the site renders somewhere other than in the document body. */
const CLAIMED_SECTION_SLUGS = ['part-of-hyperfrontend']

/**
 * Reduce a package README to what its documentation page actually shows.
 *
 * A README is portable package documentation and stays that way: nothing here
 * writes to a source file. What it does is claim the sections whose content the
 * site has a better home for, so the rendered page states each fact once.
 *
 * `Part of hyperfrontend` goes entirely: it existed only to point elsewhere,
 * which is what the page already ends with.
 *
 * Both the page and the search index run through here, so a result can never
 * deep-link a reader to a section the page no longer renders.
 *
 * @param markdown - The package README, after any link transformation
 * @returns The markdown the page renders
 *
 * @example What the page is left to render
 * ```ts
 * preparePackageReadme('Intro.\n\n## Part of hyperfrontend\n\nOne of many.\n')
 * // 'Intro.'
 * ```
 */
export function preparePackageReadme(markdown: string): string {
  return dropSections(markdown, CLAIMED_SECTION_SLUGS)
}
