import type { LibraryFacts } from './library-facts'
import { PRINT_WIDTH, blockBounds, joinLines, quote, splitLines } from './lines'

/** The line that opens the list of libraries the generator documents. */
const LIBRARIES_OPENER = 'const LIBRARIES: LibraryConfig[] = ['

/** The line that opens the slugs the generator rewrites architecture links with. */
const SLUGS_OPENER = 'const LIBRARY_SLUGS: Record<string, string> = {'

/**
 * Add the library to the generator's list, when it is not there.
 *
 * @param lines - The script's lines, changed in place
 * @param facts - What was derived from the package's project
 */
function addLibraryConfig(lines: string[], facts: LibraryFacts): void {
  const { open, close } = blockBounds(
    lines,
    (line) => line === LIBRARIES_OPENER,
    (line) => line === ']',
    'generate-docs.ts LIBRARIES'
  )
  const marker = `packageName: ${quote(facts.packageName)}`
  if (lines.slice(open, close).some((line) => line.includes(marker))) return
  const fields = [
    `name: ${quote(facts.displayName)}`,
    marker,
    `slug: ${quote(facts.manifestSlug)}`,
    `srcPath: ${quote(facts.projectRoot)}`,
    `category: ${quote(facts.docsCategory)}`,
  ]
  const inline = `  { ${fields.join(', ')} },`
  lines.splice(close, 0, ...(inline.length <= PRINT_WIDTH ? [inline] : ['  {', ...fields.map((field) => `    ${field},`), '  },']))
}

/**
 * Add the library's slug to the architecture link map, when it is not there.
 *
 * @param lines - The script's lines, changed in place
 * @param facts - What was derived from the package's project
 */
function addLibrarySlug(lines: string[], facts: LibraryFacts): void {
  const { open, close } = blockBounds(
    lines,
    (line) => line === SLUGS_OPENER,
    (line) => line === '}',
    'generate-docs.ts LIBRARY_SLUGS'
  )
  const key = facts.routeSlug.includes('-') ? quote(facts.routeSlug) : facts.routeSlug
  const entry = `${key}: ${quote(facts.routeSlug)}`
  if (lines.slice(open, close).some((line) => line.includes(entry))) return
  lines.splice(close, 0, `  ${entry},`)
}

/**
 * Register a library with the docs-site generator script: an entry in the
 * libraries it documents, and for a package listed outside the utilities, a
 * slug for the architecture links it rewrites.
 *
 * @param content - `apps/docs-site/scripts/generate-docs.ts`
 * @param facts - What was derived from the package's project
 * @returns The script with the library present
 * @throws {Error} When the script's lists cannot be found
 *
 * @example
 * ```typescript
 * const updated = registerLibraryInGenerateDocs(readFileSync(script, 'utf-8'), facts)
 * ```
 */
export function registerLibraryInGenerateDocs(content: string, facts: LibraryFacts): string {
  const text = splitLines(content)
  addLibraryConfig(text.lines, facts)
  if (facts.docsCategory !== 'utils') addLibrarySlug(text.lines, facts)
  return joinLines(text)
}
