import type { DocsCategory, LibraryFacts } from './library-facts'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { PRINT_WIDTH, blockBounds, joinLines, quote, splitLines } from '@hyperfrontend/workspace/generators'

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
 * A page below a package's own page, or a path segment that only groups the
 * pages below it.
 */
interface NavNode {
  /** The path segment the entry is labelled with */
  slug: string
  /** The route of the segment's own page; absent when no entry point sits at it */
  href?: string
  /** The entries one segment further down */
  children: NavNode[]
}

/**
 * Arrange subpaths as the tree their segments form, so `executors/build` and
 * `executors/test` become `build` and `test` under one `executors` entry.
 *
 * A segment is given a route only when a subpath ends at it: the site has a
 * page per entry point and none for a directory that merely holds some.
 *
 * @param href - The route of the package's own page
 * @param subpaths - The pages below it, as paths relative to it
 * @returns The entries directly below the package, in first-seen order
 */
function treeOf(href: string, subpaths: readonly string[]): NavNode[] {
  const roots: NavNode[] = []
  for (const subpath of subpaths) {
    const segments = subpath.split('/')
    let level = roots
    let route = href
    segments.forEach((segment, depth) => {
      route = `${route}/${segment}`
      let node = level.find((candidate) => candidate.slug === segment)
      if (node === undefined) {
        node = { slug: segment, children: [] }
        level.push(node)
      }
      if (depth === segments.length - 1) node.href = route
      level = node.children
    })
  }
  return roots
}

/**
 * The lines of a `children` array, as the formatter would leave them: a lone
 * entry that fits stays on the array's own line, anything else gets a line
 * per entry.
 *
 * @param children - The entries of the array
 * @param indent - The indentation of the `children` field
 * @returns The field's lines, none for an entry with nothing under it
 */
function childrenLines(children: readonly NavNode[], indent: string): string[] {
  if (children.length === 0) return []
  const rendered = children.map((child) =>
    entryLines(
      [`slug: ${quote(child.slug)}`, ...(child.href === undefined ? [] : [`href: ${quote(child.href)}`])],
      child.children,
      `${indent}  `
    )
  )
  const only = rendered.length === 1 ? (rendered[0] as string[]) : []
  if (only.length === 1) {
    const inline = `${indent}children: [${(only[0] as string).trim().slice(0, -1)}],`
    if (inline.length <= PRINT_WIDTH) return [inline]
  }
  return [`${indent}children: [`, ...rendered.flat(), `${indent}],`]
}

/**
 * The lines of one navigation entry, as the formatter would leave them: on
 * one line when it has nothing under it and fits, a line per field otherwise.
 *
 * @param fields - The entry's own fields, each as `key: value`
 * @param children - The entries under it
 * @param indent - The indentation of the entry
 * @returns The entry's lines, the last ending in a comma
 */
function entryLines(fields: readonly string[], children: readonly NavNode[], indent: string): string[] {
  const inline = `${indent}{ ${fields.join(', ')} },`
  if (children.length === 0 && inline.length <= PRINT_WIDTH) return [inline]
  return [`${indent}{`, ...fields.map((field) => `${indent}  ${field},`), ...childrenLines(children, `${indent}  `), `${indent}},`]
}

/**
 * The lines of the library's navigation entry: its page, and under it its
 * architecture document and its secondary entries, nested by path segment so
 * every package breaks its subpaths down the same way.
 *
 * @param facts - What was derived from the package's project
 * @returns The entry's lines, indented for the array
 */
export function navigationEntry(facts: LibraryFacts): string[] {
  const href = `/docs/libraries/${facts.routeSlug}`
  const head = [`slug: ${quote(facts.libName)}`, `packageName: ${quote(facts.packageName)}`, `href: ${quote(href)}`]
  return entryLines(head, treeOf(href, [...(facts.hasArchitecture ? ['architecture'] : []), ...facts.secondaryEntries]), '  ')
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
