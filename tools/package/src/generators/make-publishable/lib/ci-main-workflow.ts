import type { LibraryFacts } from './library-facts'
import { isUtilsRoot } from './library-facts'
import { blockBounds, indentOf, joinLines, splitLines } from './lines'

/** The line that opens the array of coverage uploads. */
const ARRAY_OPENER = 'LIBS=('

/**
 * One coverage upload: the flag it reports under and the project it reads.
 */
interface CoverageEntry {
  /** Codecov flag */
  flag: string
  /** Whether the project sits under `libs/utils` */
  utility: boolean
  /** Index of the entry's line */
  line: number
}

/**
 * Whether the main workflow already uploads a library's coverage.
 *
 * @param content - The workflow
 * @param coverageFlag - Codecov flag, `data-utils`
 * @param projectRoot - Workspace-relative project root, `libs/utils/data`
 * @returns True when the array lists the pair
 */
export function hasCoverageEntry(content: string, coverageFlag: string, projectRoot: string): boolean {
  return content.includes(`"${coverageFlag}:${projectRoot}"`)
}

/**
 * Read an entry line of the array.
 *
 * @param line - One line of the file
 * @param index - Its index
 * @returns The entry, or null for a line that is not one
 */
function parseEntry(line: string, index: number): CoverageEntry | null {
  const trimmed = line.trim()
  const separator = trimmed.indexOf(':')
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"') || separator === -1) return null
  return { flag: trimmed.slice(1, separator), utility: isUtilsRoot(trimmed.slice(separator + 1, -1)), line: index }
}

/**
 * Register a library's coverage upload in the main workflow.
 *
 * The array keeps the packages under `libs` before the utilities, each group
 * alphabetical by flag, and the entry is placed where that order puts it.
 *
 * @param content - `.github/workflows/ci-main.yml`
 * @param facts - What was derived from the package's project
 * @returns The workflow with the entry present
 * @throws {Error} When the workflow carries no `LIBS=(` array
 *
 * @example
 * ```typescript
 * const updated = registerLibraryCoverageUpload(readFileSync(workflow, 'utf-8'), facts)
 * ```
 */
export function registerLibraryCoverageUpload(content: string, facts: LibraryFacts): string {
  if (hasCoverageEntry(content, facts.coverageFlag, facts.projectRoot)) return content
  const text = splitLines(content)
  const { open, close } = blockBounds(
    text.lines,
    (line) => line.trim() === ARRAY_OPENER,
    (line) => line.trim() === ')',
    'ci-main.yml coverage uploads'
  )
  const entries: CoverageEntry[] = []
  for (let index = open + 1; index < close; index++) {
    const entry = parseEntry(text.lines[index] as string, index)
    if (entry !== null) entries.push(entry)
  }
  const utility = isUtilsRoot(facts.projectRoot)
  const successor = entries.find((entry) => (entry.utility && !utility) || (entry.utility === utility && entry.flag > facts.coverageFlag))
  const first = entries[0]
  const indent = first === undefined ? `${indentOf(text.lines[open] as string)}  ` : indentOf(text.lines[first.line] as string)
  text.lines.splice(successor === undefined ? close : successor.line, 0, `${indent}"${facts.coverageFlag}:${facts.projectRoot}"`)
  return joinLines(text)
}
