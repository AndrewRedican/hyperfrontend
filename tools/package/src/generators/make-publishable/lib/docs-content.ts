import type { LibraryFacts } from './library-facts'
import { posix } from 'node:path'
import { PRINT_WIDTH, blockBounds, joinLines, quote, splitLines } from './lines'

/** The line that opens the list of libraries the site renders. */
const LIBRARIES_OPENER = 'export const LIBRARIES: LibraryInfo[] = ['

/**
 * Register a library with the docs site's content model, after every library
 * already listed.
 *
 * @param content - `apps/docs-site/src/lib/content.ts`
 * @param facts - What was derived from the package's project
 * @returns The module with the library present
 * @throws {Error} When the list cannot be found
 *
 * @example
 * ```typescript
 * const updated = registerLibraryInContent(readFileSync(module, 'utf-8'), facts)
 * ```
 */
export function registerLibraryInContent(content: string, facts: LibraryFacts): string {
  const text = splitLines(content)
  const { open, close } = blockBounds(
    text.lines,
    (line) => line === LIBRARIES_OPENER,
    (line) => line === ']',
    'content.ts LIBRARIES'
  )
  const marker = `packageName: ${quote(facts.packageName)}`
  if (text.lines.slice(open, close).some((line) => line.includes(marker))) return content
  const entryPoints = facts.entryPoints.map(quote)
  const inlineEntryPoints = `    entryPoints: [${entryPoints.join(', ')}],`
  const entry = [
    '  {',
    `    name: ${quote(facts.displayName)},`,
    `    ${marker},`,
    `    slug: ${quote(facts.routeSlug)},`,
    `    readmePath: ${quote(posix.join(facts.projectRoot, 'README.md'))},`,
    ...(facts.hasArchitecture ? [`    architecturePath: ${quote(posix.join(facts.projectRoot, 'ARCHITECTURE.md'))},`] : []),
    ...(inlineEntryPoints.length <= PRINT_WIDTH
      ? [inlineEntryPoints]
      : ['    entryPoints: [', ...entryPoints.map((entryPoint) => `      ${entryPoint},`), '    ],']),
    `    category: ${quote(facts.docsCategory)},`,
    '  },',
  ]
  text.lines.splice(close, 0, ...entry)
  return joinLines(text)
}
