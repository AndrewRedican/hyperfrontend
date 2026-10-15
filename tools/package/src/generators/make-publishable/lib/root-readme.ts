import type { LibraryFacts } from './library-facts'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { findLine, joinLines, splitLines } from './lines'

/** The level-two heading of the section that tables every package. */
export const PACKAGES_SECTION = 'Packages'

/** Where a package's source is linked to. */
const BLOB_BASE = 'https://github.com/AndrewRedican/hyperfrontend/blob/main/'

/** Where a package's documentation is linked to. */
const DOCS_BASE = 'https://www.hyperfrontend.dev/docs/libraries/'

/** The number words the table's summary counts with, below twenty. */
const UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]

/** The number words for the tens, indexed by the tens digit. */
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/**
 * A count written in words, the way the summary line writes it.
 *
 * @param count - A count
 * @returns `nineteen`, `twenty-one`; a count of a hundred or more stays in digits
 */
export function numberWord(count: number): string {
  if (count >= 100) return `${count}`
  if (count < 20) return UNITS[count] as string
  const tens = TENS[(count - (count % 10)) / 10] as string
  return count % 10 === 0 ? tens : `${tens}-${UNITS[count % 10] as string}`
}

/** Every count the summary can be read back from, so a summary written some other way is left alone. */
const COUNT_WORDS: string[] = []
for (let count = 0; count < 100; count++) COUNT_WORDS.push(numberWord(count))

/**
 * Whether the table already links a project.
 *
 * @param content - The root README
 * @param projectRoot - Workspace-relative project root
 * @returns True when a row links the project's source
 */
export function hasPackageRow(content: string, projectRoot: string): boolean {
  return content.includes(`${BLOB_BASE}${projectRoot})`)
}

/**
 * The cells of a package's row: the linked name, then the description with a
 * link to its documentation.
 *
 * @param facts - What was derived from the package's project
 * @returns The two cells
 */
export function packageRow(facts: LibraryFacts): string[] {
  const description = facts.description.endsWith('.') ? facts.description.slice(0, -1) : facts.description
  return [`[${facts.packageName}](${BLOB_BASE}${facts.projectRoot})`, `${description} · [docs](${DOCS_BASE}${facts.routeSlug}/)`]
}

/**
 * The cells of a table row.
 *
 * @param line - A `| a | b |` line
 * @returns The trimmed cells
 */
function cellsOf(line: string): string[] {
  const inner = line.trim().slice(1, -1)
  return inner.split('|').map((cell) => cell.trim())
}

/**
 * Write rows back as a table whose columns are padded to their widest cell.
 *
 * @param header - The header cells
 * @param rows - The body rows
 * @returns The table's lines
 */
function renderTable(header: string[], rows: string[][]): string[] {
  const widths = header.map((cell, column) => max(cell.length, ...rows.map((row) => (row[column] as string).length)))
  const renderRow = (cells: string[]): string => `| ${cells.map((cell, column) => cell.padEnd(widths[column] as number)).join(' | ')} |`
  return [renderRow(header), renderRow(widths.map((width) => '-'.repeat(width))), ...rows.map(renderRow)]
}

/**
 * Rewrite the `<summary>All <count> packages</summary>` line, when the
 * section has one and its count is written in words.
 *
 * @param lines - The README's lines, changed in place
 * @param from - The first line of the section
 * @param to - The line after the section's last
 * @param count - How many packages the table now lists
 */
function renderSummaryCount(lines: string[], from: number, to: number, count: number): void {
  const index = findLine(lines, (line) => line.trim().startsWith('<summary>All ') && line.trim().endsWith(' packages</summary>'), from)
  if (index === -1 || index >= to) return
  const line = lines[index] as string
  const word = line.trim().slice('<summary>All '.length, -' packages</summary>'.length)
  if (!COUNT_WORDS.includes(word)) return
  lines[index] = line.replace(`All ${word} packages`, `All ${numberWord(count)} packages`)
}

/**
 * Add a package's row to the table in the root README's packages section.
 *
 * The table lists the packages in the order the docs-site index presents
 * them, so the row goes after the package that precedes this one there, or
 * last when none does. Every column is re-padded, and the summary's count
 * follows the table, so the README keeps reading as if it had been written
 * with the package in it.
 *
 * @param content - The root README
 * @param facts - What was derived from the package's project
 * @param precededBy - The package the index places just before this one, or null to append
 * @returns The README with the row present
 * @throws {Error} When the section or its table is missing
 *
 * @example
 * ```typescript
 * const updated = registerPackageRow(readme, facts, '@hyperfrontend/questions')
 * ```
 */
export function registerPackageRow(content: string, facts: LibraryFacts, precededBy: string | null): string {
  if (hasPackageRow(content, facts.projectRoot)) return content
  const text = splitLines(content)
  const heading = findLine(text.lines, (line) => line === `## ${PACKAGES_SECTION}`, 0)
  if (heading === -1) throw createError(`README.md has no "## ${PACKAGES_SECTION}" section to list the package in`)
  const nextHeading = findLine(text.lines, (line) => line.startsWith('## '), heading + 1)
  const end = nextHeading === -1 ? text.lines.length : nextHeading
  const tableStart = findLine(text.lines, (line) => line.startsWith('|'), heading + 1)
  if (tableStart === -1 || tableStart >= end)
    throw createError(`README.md's "## ${PACKAGES_SECTION}" section has no table to add the package to`)
  let tableEnd = tableStart
  while (tableEnd < end && (text.lines[tableEnd] as string).startsWith('|')) tableEnd++
  const [header, , ...rows] = text.lines.slice(tableStart, tableEnd).map(cellsOf)
  const predecessor = precededBy === null ? -1 : rows.findIndex((row) => (row[0] as string).startsWith(`[${precededBy}](`))
  rows.splice(predecessor === -1 ? rows.length : predecessor + 1, 0, packageRow(facts))
  renderSummaryCount(text.lines, heading, tableStart, rows.length)
  text.lines.splice(tableStart, tableEnd - tableStart, ...renderTable(header as string[], rows))
  return joinLines(text)
}
