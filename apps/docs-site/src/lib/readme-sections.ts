import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { generateSlug } from './slug'

/** Lines {@link enhanceSection} adds: a blank, the placeholder, and a blank. */
const PLACEHOLDER_LINES = 3

/**
 * One heading in a markdown document, with the span of lines it owns.
 *
 * A section owns everything below its heading up to the next heading of the
 * same level or shallower, so a level-2 range covers its level-3 subsections
 * too.
 */
export interface MarkdownSectionRange {
  /** Heading level (1 for `#`, 2 for `##`, and so on) */
  level: number
  /** Heading text as written, inline markdown included */
  title: string
  /** The anchor id the rendered page gives this heading */
  slug: string
  /** Index of the heading line */
  headingLine: number
  /** Index one past the last line the section owns */
  endLine: number
}

/**
 * A document split into the part a page renders and the parts it has claimed.
 */
export interface ReadmeSplit {
  /** The document title, taken from the leading level-1 heading */
  title: string | null
  /** What is left to render, with claimed sections removed */
  body: string
}

/**
 * Map a document's headings to the spans of lines they own.
 *
 * Fenced code blocks are skipped, so a `#` comment in a shell sample is never
 * mistaken for a heading. Slugs come from the site's one anchor algorithm, so a
 * caller naming a section by slug names the same thing the rendered page and
 * the document index do.
 *
 * @param markdown - Raw markdown content
 * @returns Every heading in document order, with the lines it owns
 *
 * @example Locating the license section
 * ```ts
 * findSections(readme).find((section) => section.level === 2 && section.slug === 'license')
 * ```
 */
export function findSections(markdown: string): MarkdownSectionRange[] {
  const lines = markdown.split('\n')
  const sections: MarkdownSectionRange[] = []
  const open: MarkdownSectionRange[] = []
  let inFence = false

  lines.forEach((line, index) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      return
    }
    if (inFence) return

    const match = /^(#{1,6})\s+(.*)$/.exec(line)
    if (!match) return

    const level = match[1].length
    while (open.length > 0 && open[open.length - 1].level >= level) {
      const closed = open.pop()
      if (closed) closed.endLine = index
    }

    const section: MarkdownSectionRange = {
      level,
      title: match[2].trim(),
      slug: generateSlug(match[2].trim()),
      headingLine: index,
      endLine: lines.length,
    }
    sections.push(section)
    open.push(section)
  })

  return sections
}

/**
 * Take the markdown of one section, heading excluded.
 *
 * @param markdown - Raw markdown content
 * @param slug - The section's anchor id
 * @param level - The heading level to match
 * @returns The section's own markdown, or null when the document has no such section
 */
export function readSection(markdown: string, slug: string, level = 2): string | null {
  const section = findSections(markdown).find((candidate) => candidate.level === level && candidate.slug === slug)
  if (!section) return null
  return markdown
    .split('\n')
    .slice(section.headingLine + 1, section.endLine)
    .join('\n')
    .trim()
}

/**
 * Take the first link a section points at.
 *
 * The site moves a few short sections out of the rendered document and into
 * compact metadata, and a licence is the clearest case: two words and a link.
 * The destination still belongs to the package rather than to the site, so it
 * is read out of the README rather than reconstructed, and a package that
 * points its licence somewhere unusual keeps pointing there.
 *
 * @param markdown - Raw markdown content
 * @param slug - The section's anchor id
 * @param level - The heading level to match
 * @returns The first link's destination, or null when the section is absent or carries no link
 */
export function readSectionLink(markdown: string, slug: string, level = 2): string | null {
  const section = readSection(markdown, slug, level)
  if (!section) return null
  const link = /\[[^\]]*\]\(([^)\s]+)/.exec(section)
  return link ? link[1] : null
}

/**
 * Remove whole sections from a document, subsections included.
 *
 * @param markdown - Raw markdown content
 * @param slugs - Anchor ids of the level-2 sections to drop
 * @returns The document without them
 */
export function dropSections(markdown: string, slugs: readonly string[]): string {
  const wanted = createSet(slugs)
  const doomed = findSections(markdown).filter((section) => section.level === 2 && wanted.has(section.slug))
  return removeLineRanges(
    markdown,
    doomed.map((section) => [section.headingLine, section.endLine])
  )
}

/**
 * Replace a section's own prose with a placeholder the page renders a
 * component into, leaving the heading and any subsections not named for
 * removal in place.
 *
 * This is how a README section becomes richer UI without the README losing it:
 * the heading still anchors the same part of the document, the subsections that
 * carry content the site does not model (CDN snippets, peer dependencies) are
 * untouched, and only the part the site has a better rendering for is lifted
 * out.
 *
 * @param markdown - Raw markdown content
 * @param slug - Anchor id of the level-2 section to enhance
 * @param placeholder - Raw HTML the renderer swaps for a component
 * @param dropSubsections - Anchor ids of level-3 subsections to remove as well
 * @returns The document with the section's prose replaced, unchanged when it has no such section
 */
export function enhanceSection(markdown: string, slug: string, placeholder: string, dropSubsections: readonly string[] = []): string {
  const sections = findSections(markdown)
  const section = sections.find((candidate) => candidate.level === 2 && candidate.slug === slug)
  if (!section) return markdown

  const nested = sections.filter(
    (candidate) => candidate.level > 2 && candidate.headingLine > section.headingLine && candidate.headingLine < section.endLine
  )
  const kept = nested.filter((candidate) => !dropSubsections.includes(candidate.slug))
  const leadEnd = kept.length > 0 ? kept[0].headingLine : section.endLine

  // why: everything before the first kept subsection already goes with the lead, so a dropped subsection sitting there must not be listed again; two ranges covering the same lines splice twice and cut live content, which in a README means cutting a fence open and letting its sample HTML run
  const ranges: [number, number][] = [[section.headingLine + 1, leadEnd]]
  for (const subsection of nested) {
    if (dropSubsections.includes(subsection.slug) && subsection.headingLine >= leadEnd) {
      ranges.push([subsection.headingLine, subsection.endLine])
    }
  }

  const lines = markdown.split('\n')
  // why: the placeholder is a raw HTML block, and a markdown HTML block runs to the next blank line; without the trailing one it swallows whichever subsection was kept and prints its heading as text
  lines[section.headingLine] = `${lines[section.headingLine]}\n\n${placeholder}\n`
  return removeLineRanges(lines.join('\n'), shiftAfter(ranges, section.headingLine, PLACEHOLDER_LINES))
}

/**
 * Take the leading level-1 heading off a document, so a page can render it as
 * its own title rather than as the first thing inside the prose.
 *
 * @param markdown - Raw markdown content
 * @returns The title and the rest of the document
 */
export function splitTitle(markdown: string): ReadmeSplit {
  const lines = markdown.split('\n')
  const index = lines.findIndex((line) => line.trim() !== '')
  const match = index === -1 ? null : /^#\s+(.*)$/.exec(lines[index])

  if (!match) return { title: null, body: markdown }

  lines.splice(0, index + 1)
  return { title: match[1].trim(), body: lines.join('\n').trim() }
}

/**
 * Drop line spans from a document, back to front so earlier indices stay valid.
 *
 * @param markdown - Raw markdown content
 * @param ranges - Half-open `[start, end)` line spans to remove
 * @returns The document without them
 */
function removeLineRanges(markdown: string, ranges: readonly [number, number][]): string {
  const lines = markdown.split('\n')

  // why: overlapping spans would splice the same lines twice and take live content with them, so they are merged before anything is cut
  const merged: [number, number][] = []
  for (const [start, end] of [...ranges].sort((left, right) => left[0] - right[0])) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) {
      last[1] = max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }

  for (const [start, end] of merged.reverse()) {
    lines.splice(start, end - start)
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Move line spans that sit after an insertion point down by the lines added.
 *
 * @param ranges - Half-open `[start, end)` line spans
 * @param afterLine - The line the insertion happened on
 * @param added - How many lines were added
 * @returns The shifted spans
 */
function shiftAfter(ranges: readonly [number, number][], afterLine: number, added: number): [number, number][] {
  return ranges.map(([start, end]): [number, number] => [start > afterLine ? start + added : start, end > afterLine ? end + added : end])
}
