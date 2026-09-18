/**
 * The heading level a symbol's own heading takes in the reference.
 *
 * The same symbol renderers serve three outlines. On a package page the
 * reference is an `h2`, its kind sections are `h3` and a symbol is an `h4`;
 * grouped by module the module is an `h3`, the kind an `h4` and the symbol an
 * `h5`; on a secondary entrypoint's page the kind is an `h3` and the symbol an
 * `h4`. A symbol's own sub-headings (parameters, returns, properties) sit one
 * level under it, so the outline a screen reader or a crawler reads never
 * climbs back up inside a section.
 */
export type ApiHeadingLevel = 3 | 4 | 5

/** The heading elements the reference renders, the symbol's level and the one beneath it. */
export type ApiHeadingTag = 'h3' | 'h4' | 'h5' | 'h6'

/**
 * The heading element for a level.
 *
 * @param level - A symbol heading level, or the level under one
 * @returns The element name to render
 * @example
 * ```typescript
 * headingTag(4) // 'h4'
 * ```
 */
export function headingTag(level: ApiHeadingLevel | 6): ApiHeadingTag {
  return `h${level}`
}
