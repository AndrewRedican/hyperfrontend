import type { DocsCategory, LibraryFacts } from './library-facts'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { PRINT_WIDTH, blockBounds, joinLines, quote, splitLines } from './lines'

/** The navigation array each section of the index is written in. */
const ARRAYS: Record<DocsCategory, string> = {
  core: 'coreLibraries',
  supporting: 'supportingLibraries',
  utils: 'utilsLibraries',
}

/**
 * Where a top-level navigation entry starts, and the slug it is sorted by.
 */
interface NavEntry {
  /** The entry's slug */
  slug: string
  /** Index of the entry's first line */
  start: number
}

/**
 * The slug a navigation entry declares.
 *
 * @param line - The line carrying the entry's `slug:` field
 * @returns The quoted value of that field
 * @throws {Error} When the line declares none
 */
function slugOf(line: string): string {
  const field = 'slug: '
  const start = line.indexOf(field)
  if (start === -1) throw createError(`navigation.ts entry declares no slug: ${line.trim()}`)
  const literal = line.slice(start + field.length)
  return literal.slice(1, literal.indexOf("'", 1))
}

/**
 * The top-level entries of a navigation array, in order.
 *
 * @param lines - The module's lines
 * @param open - Index of the line that opens the array
 * @param close - Index of the line that closes it
 * @returns Each entry's slug and first line
 */
function entriesOf(lines: readonly string[], open: number, close: number): NavEntry[] {
  const entries: NavEntry[] = []
  for (let index = open + 1; index < close; index++) {
    const line = lines[index] as string
    if (!line.startsWith('  {')) continue
    entries.push({ slug: slugOf(line.endsWith('},') ? line : (lines[index + 1] as string)), start: index })
  }
  return entries
}

/**
 * The lines of the library's navigation entry: its page, and under it its
 * architecture document and each secondary entry, as a single line when
 * there is nothing under it.
 *
 * @param facts - What was derived from the package's project
 * @returns The entry's lines, indented for the array
 */
export function navigationEntry(facts: LibraryFacts): string[] {
  const href = `/docs/libraries/${facts.routeSlug}`
  const head = [`slug: ${quote(facts.libName)}`, `packageName: ${quote(facts.packageName)}`, `href: ${quote(href)}`]
  const children = [...(facts.hasArchitecture ? ['architecture'] : []), ...facts.secondaryEntries].map(
    (child) => `{ slug: ${quote(child)}, href: ${quote(`${href}/${child}`)} }`
  )
  if (children.length === 0) {
    const inline = `  { ${head.join(', ')} },`
    return inline.length <= PRINT_WIDTH ? [inline] : ['  {', ...head.map((field) => `    ${field},`), '  },']
  }
  const inlineChildren = `    children: [${children.join(', ')}],`
  const childLines =
    children.length === 1 && inlineChildren.length <= PRINT_WIDTH
      ? [inlineChildren]
      : ['    children: [', ...children.map((child) => `      ${child},`), '    ],']
  return ['  {', ...head.map((field) => `    ${field},`), ...childLines, '  },']
}

/**
 * Register a library in the docs-site navigation, in the array its section is
 * written in, at the position its slug sorts to.
 *
 * @param content - `apps/docs-site/src/lib/navigation.ts`
 * @param facts - What was derived from the package's project
 * @returns The module with the entry present
 * @throws {Error} When the section's array cannot be found
 *
 * @example
 * ```typescript
 * const updated = registerLibraryInNavigation(readFileSync(module, 'utf-8'), facts)
 * ```
 */
export function registerLibraryInNavigation(content: string, facts: LibraryFacts): string {
  if (content.includes(`packageName: ${quote(facts.packageName)}`)) return content
  const text = splitLines(content)
  const array = ARRAYS[facts.docsCategory]
  const { open, close } = blockBounds(
    text.lines,
    (line) => line === `const ${array}: NavItem[] = [`,
    (line) => line === ']',
    `navigation.ts ${array}`
  )
  const successor = entriesOf(text.lines, open, close).find((entry) => entry.slug > facts.libName)
  text.lines.splice(successor === undefined ? close : successor.start, 0, ...navigationEntry(facts))
  return joinLines(text)
}
