import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { markdownToInlineHtml } from './markdown'
import { readSection } from './readme-sections'

/** Anchor id of the README subsection the site draws for itself. */
export const KEY_FEATURES_SLUG = 'key-features'

/** Heading level the subsection sits at, under the package's opening section. */
export const KEY_FEATURES_LEVEL = 3

/** Separators an author may put between a feature's label and its explanation. */
const SEPARATORS: readonly string[] = [': ', ' - ', ' – ', ' — ']

/** One capability as the README wrote it, before its markdown is rendered. */
interface RawFeature {
  /** The capability's name, as markdown. */
  label: string
  /** A qualifier the author put between the name and the explanation, as markdown. */
  detail: string
  /** Why the capability matters, as markdown. */
  description: string
}

/** One capability, split into the part a reader scans and the part they read. */
export interface KeyFeature {
  /** The capability's name, as inline HTML. */
  label: string
  /** A qualifier the author put between the name and the explanation, as inline HTML. */
  detail: string
  /** Why the capability matters, as inline HTML. */
  description: string
}

/**
 * Split one list item into a label and an explanation.
 *
 * The convention every package README already follows is a bold name, an
 * optional qualifier, a separator, and a sentence. Splitting on the first
 * separator rather than the last is what keeps a description containing a colon
 * from being cut in half.
 *
 * @param item - The list item's markdown, without its bullet.
 * @returns The three parts, or null when the item is not in the convention.
 */
function splitFeature(item: string): RawFeature | null {
  const bold = /^\*\*(.+?)\*\*/.exec(item.trim())
  if (bold === null) {
    return null
  }
  const label = bold[1]?.trim() ?? ''
  const rest = item.trim().slice(bold[0].length)
  const at = SEPARATORS.map((separator) => rest.indexOf(separator))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0]
  if (at === undefined) {
    // why: a bold label with nothing after it is a feature the reader is told the name of and nothing else, which is exactly what the lint rule exists to catch rather than something to render around
    return label === '' ? null : { label, detail: '', description: rest.trim() }
  }
  const separator = SEPARATORS.find((candidate) => rest.startsWith(candidate, at)) ?? ': '
  return { label, detail: rest.slice(0, at).trim(), description: rest.slice(at + separator.length).trim() }
}

/**
 * Take the bullet list out of a section's markdown.
 *
 * Only top-level items are collected. A nested bullet belongs to the item above
 * it, and this rendering has nowhere to put one, so a section that uses them
 * falls back to plain markdown rather than silently losing them.
 *
 * @param section - The section's markdown.
 * @returns The items, or null when the section is not a flat bullet list.
 */
function readItems(section: string): string[] | null {
  const items: string[] = []
  for (const line of section.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('<!--')) {
      continue
    }
    if (line.startsWith('  ') || !/^[-*]\s+/.test(trimmed)) {
      return null
    }
    items.push(trimmed.replace(/^[-*]\s+/, ''))
  }
  return items.length === 0 ? null : items
}

/**
 * Read a README's key features into something the page can lay out itself.
 *
 * The markdown stays the source: this reads it, and the page renders the
 * result only when every item is in the convention. A README that states its
 * features some other way keeps its own rendering rather than being forced
 * through a shape it does not fit, which is what makes this an enhancement of a
 * correct section rather than a requirement placed on every one.
 *
 * @param markdown - The package README, after the site's link transformation.
 * @returns The features, or null when the section is absent or unconventional.
 *
 * @example Reading a package's features
 * ```ts
 * const features = await readKeyFeatures(readme)
 * features?.[0]?.label // 'Multi-format output'
 * ```
 */
export async function readKeyFeatures(markdown: string): Promise<KeyFeature[] | null> {
  const section = readSection(markdown, KEY_FEATURES_SLUG, KEY_FEATURES_LEVEL)
  if (section === null) {
    return null
  }
  const items = readItems(section)
  if (items === null) {
    return null
  }
  const parsed = items.map(splitFeature)
  if (parsed.some((feature) => feature === null || feature.description === '')) {
    return null
  }
  return promiseAll(
    parsed.map(async (feature) => ({
      label: await markdownToInlineHtml(feature?.label ?? ''),
      detail: feature?.detail === '' ? '' : await markdownToInlineHtml(feature?.detail ?? ''),
      description: await markdownToInlineHtml(feature?.description ?? ''),
    }))
  )
}
