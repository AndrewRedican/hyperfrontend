import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { fromCodePoint as fromCodePointOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/string'

/**
 * Generate a URL-safe slug from heading text, GitHub-style.
 *
 * This is the site's single anchor-id algorithm: the client-side heading
 * injector, hand-authored headings, and the search index all derive ids from
 * it, so a deep link produced by one is always resolvable by the others.
 *
 * @param text - The heading text to convert
 * @returns URL-safe slug
 *
 * @example
 * ```typescript
 * generateSlug('Installation Guide')  // 'installation-guide'
 * generateSlug('API Reference')       // 'api-reference'
 * generateSlug('Getting Started!')    // 'getting-started'
 * ```
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Create a slugger that disambiguates duplicate headings the way the rendered
 * page does: the second occurrence of a slug gets `-1`, the third `-2`, and so on.
 *
 * @returns A function mapping heading text to the unique id it receives on the page
 */
export function createHeadingSlugger(): (text: string) => string {
  const usedIds = createSet<string>()

  return (text: string) => {
    let id = generateSlug(text)
    if (usedIds.has(id)) {
      let suffix = 1
      while (usedIds.has(`${id}-${suffix}`)) {
        suffix++
      }
      id = `${id}-${suffix}`
    }
    usedIds.add(id)
    return id
  }
}

/**
 * Reduce a markdown heading line's inline syntax to the plain text the
 * rendered heading displays.
 *
 * @param heading - Heading text after the `#` markers
 * @returns Plain display text
 */
export function stripInlineMarkdown(heading: string): string {
  const withoutMarkdown = heading
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')

  return decodeEntities(stripHtmlTags(withoutMarkdown)).trim()
}

/** Named character references a heading realistically carries. */
const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * Resolve the character references in heading text to the characters the
 * rendered heading actually shows.
 *
 * A heading written `## The &lt;iframe&gt;` displays as `The <iframe>`, and the
 * anchor id the page assigns is derived from that displayed text. Leaving the
 * references encoded here produces a different id from the one on the page, so
 * every link built from this text misses its target.
 *
 * Decoding runs after tags are stripped, never before: an escaped `&lt;div&gt;`
 * turned back into a tag first would then be removed as one.
 *
 * @param text - Heading text with tags already removed
 * @returns The text with character references resolved
 */
function decodeEntities(text: string): string {
  return (
    text
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_match, digits: string) => fromCodePoint(parseInt(digits, 10)))
      .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
      // why: `&amp;` resolves last, so `&amp;lt;` becomes the text `&lt;` rather than a `<`
      .replace(/&amp;/gi, '&')
  )
}

/**
 * Turn a code point into its character, leaving anything outside the Unicode
 * range as the empty string rather than throwing mid-document.
 *
 * @param codePoint - The code point to resolve
 * @returns The character, or an empty string when the value is not one
 */
function fromCodePoint(codePoint: number): string {
  return codePoint >= 0 && codePoint <= 0x10ffff ? fromCodePointOf(codePoint) : ''
}

/**
 * Remove HTML tags and comments from heading text, whether or not they are
 * terminated.
 *
 * @param text - Heading text that may carry inline HTML
 * @returns The text with every tag-like construct removed
 */
function stripHtmlTags(text: string): string {
  let current = text
  let previous = ''

  // why: One pass can splice a stray `<` onto the text behind a removed tag and form a new one, so it repeats to a fixed point
  while (current !== previous) {
    previous = current
    current = current.replace(/<\/?[a-zA-Z!][^>]*>?/g, '')
  }

  return current
}

/**
 * One addressable section of a markdown document.
 */
export interface MarkdownSection {
  /** Plain heading text */
  title: string
  /** Anchor id the heading receives on the rendered page */
  anchor: string
  /** Heading level (2 for `##`, 3 for `###`) */
  level: number
}

/**
 * Extract the addressable sections of a markdown document, with the same
 * anchor ids the rendered page assigns.
 *
 * Fenced code blocks are skipped. The document H1 is excluded (it is the page
 * title, not a section), as are headings deeper than H3, which are too
 * granular to surface as navigation targets.
 *
 * @param markdown - Raw markdown content
 * @returns Sections in document order
 */
export function extractMarkdownSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = []
  const slugger = createHeadingSlugger()
  let inFence = false

  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const match = /^(#{1,6})\s+(.*)$/.exec(line)
    if (!match) continue

    const level = match[1].length
    const title = stripInlineMarkdown(match[2])
    if (!title) continue

    // why: Every heading advances the slugger so anchors stay aligned with the page, which ids H1 and H4+ too
    const anchor = slugger(title)
    if (level < 2 || level > 3) continue

    sections.push({ title, anchor, level })
  }

  return sections
}
