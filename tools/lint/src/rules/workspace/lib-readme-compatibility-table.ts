/**
 * A publishable library's README carries, under `## Compatibility`, the runtime table its
 * `project.json` declares: one row per runtime in the order the site draws them, the Node.js row
 * naming the floor of `engines.node`. After it, and after the media region around it when there is
 * one, comes the operating-system table, which a published README keeps when the region becomes
 * an image. Padding and the delimiter row are not compared; a drifted table is rewritten from the
 * declaration, a missing operating-system table is added, and a section with no table at all is
 * reported on its heading.
 *
 * @module rules/workspace/lib-readme-compatibility-table
 */

import type { MarkdownNode } from '@hyperfrontend/linter'
import { basename, dirname } from 'node:path'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { defineRule } from '@hyperfrontend/linter'
import { isPublishableProject, readPackageFile, readProjectFile } from '@hyperfrontend/workspace/lint'

/** The heading that opens the section, matched at the start of a line. */
const HEADING = '## Compatibility'

/** The line that closes a media region. */
const MEDIA_END = '<!-- hf:media end -->'

/** The operating systems the second table lists, with the label each row shows. */
const OPERATING_SYSTEMS: readonly (readonly [string, string])[] = [
  ['Linux', 'linux'],
  ['macOS', 'macos'],
  ['Windows', 'windows'],
]

/** The glyph each declared level renders as; anything else renders as unsupported. */
const GLYPHS: Readonly<Record<string, string>> = { full: '✅', partial: '⚠️' }

/** A line of the README with the offset it starts at. */
interface Line {
  /** The text, without its line break. */
  readonly text: string
  /** The 0-based line number. */
  readonly row: number
  /** The offset of its first character. */
  readonly offset: number
}

/**
 * Splits a text into lines, a carriage return before a line feed belonging to the break.
 *
 * @param text - The README
 * @returns Its lines
 */
function linesOf(text: string): Line[] {
  let offset = 0
  // lint-disable-next-line workspace/cross-platform -- each line keeps its carriage return, which the regenerated table writes back
  return text.split('\n').map((raw, row) => {
    const line = { text: raw.endsWith('\r') ? raw.slice(0, -1) : raw, row, offset }
    offset += raw.length + 1
    return line
  })
}

/**
 * Writes the table a declaration calls for, padded as the formatter pads it.
 *
 * @param environments - The `metadata.compatibility.environments` value
 * @param engine - The `engines.node` value
 * @returns The table's lines
 */
function declaredTable(environments: unknown, engine: unknown): string[] {
  const floor = typeof engine === 'string' ? /^>=\s*(\d+)/.exec(engine)?.[1] : undefined
  const levels: Record<string, unknown> = { ...(environments as object) }
  const runtimes: [string, unknown][] = [
    [floor === undefined ? 'Node.js' : `Node.js >= ${floor}`, levels['node']],
    ['Modern Browsers', levels['browser']],
    ['Web Workers', levels['webWorker']],
  ]
  const width = max('Environment'.length, ...runtimes.map(([label]) => label.length))
  return [
    `| ${'Environment'.padEnd(width)} | Supported |`,
    `| ${'-'.repeat(width)} | :-------: |`,
    ...runtimes.map(([label, level]) => `| ${label.padEnd(width)} |    ${GLYPHS[level as string] ?? '❌'}     |`),
  ]
}

/**
 * Writes the operating-system table a declaration calls for, padded as the formatter pads it.
 *
 * @param systems - The `metadata.compatibility.operatingSystems` value
 * @returns The table's lines
 */
function declaredSystemsTable(systems: unknown): string[] {
  const levels: Record<string, unknown> = { ...(systems as object) }
  const header = 'Operating System'
  return [
    `| ${header} | Supported |`,
    `| ${'-'.repeat(header.length)} | :-------: |`,
    ...OPERATING_SYSTEMS.map(([label, key]) => `| ${label.padEnd(header.length)} |    ${GLYPHS[levels[key] as string] ?? '❌'}     |`),
  ]
}

/**
 * The lines of the table that starts at the first table line of a run of lines.
 *
 * @param lines - The lines to search
 * @returns The table's lines, empty when the run holds no table
 */
function tableIn(lines: readonly Line[]): Line[] {
  const first = lines.findIndex((line) => line.text.startsWith('|'))
  const table: Line[] = []
  if (first === -1) return table
  for (const line of lines.slice(first)) {
    if (!line.text.startsWith('|')) break
    table.push(line)
  }
  return table
}

/**
 * Reduces a table to what it says: each row but the delimiter as its trimmed cells, the text
 * before the first pipe and after the last dropped.
 *
 * @param rows - The table's lines
 * @returns One entry per row the reader sees
 */
function saying(rows: readonly string[]): string[] {
  return rows
    .filter((_, index) => index !== 1)
    .map((row) =>
      row
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
        .join(' | ')
    )
}

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/lib-readme-compatibility-table',
  language: 'markdown',
  fixable: true,
  create(context) {
    const directory = dirname(context.file.path)
    const project = readProjectFile(directory)
    if (basename(context.file.path) !== 'README.md' || !isPublishableProject(project)) return {}
    return {
      root() {
        const { text } = context.file
        const lines = linesOf(text)
        const heading = lines.find((line) => line.text.startsWith(HEADING))
        if (heading === undefined) return
        const after = lines.slice(heading.row + 1)
        const end = after.findIndex((line) => line.text.startsWith('## ') || line.text.startsWith('### '))
        const section = end === -1 ? after : after.slice(0, end)
        const table = tableIn(section)
        if (table.length === 0) {
          context.report({
            start: heading.offset,
            at: { line: heading.row + 1, column: 0, endLine: heading.row + 1, endColumn: HEADING.length },
            message:
              'The Compatibility section carries no table. Add the runtime table, which is checked against metadata.compatibility in project.json.',
          })
          return
        }
        const metadata = project?.metadata?.['compatibility'] as Record<string, unknown> | undefined
        const engines: Record<string, unknown> = { ...readPackageFile(directory)?.engines }
        const eol = text.includes('\r\n') ? '\r\n' : '\n'
        const compare = (found: readonly Line[], declared: readonly string[], message: string): void => {
          if (saying(found.map((line) => line.text)).join('\n') === saying(declared).join('\n')) return
          const first = found[0] as Line
          const last = found[found.length - 1] as Line
          context.report({
            start: first.offset,
            at: { line: first.row + 1, column: 0, endLine: last.row + 1, endColumn: last.text.length },
            message,
            fix: { start: first.offset, end: last.offset + last.text.length, text: declared.join(eol) },
          })
        }
        compare(
          table,
          declaredTable(metadata?.['environments'], engines['node']),
          'The compatibility table does not match metadata.compatibility in project.json and engines.node in package.json. Run lint with --fix to regenerate it.'
        )
        const rest = section.slice(section.indexOf(table[table.length - 1] as Line) + 1)
        const closing = rest.findIndex((line) => line.text.trim() !== '')
        const region = rest[closing]?.text.trim() === MEDIA_END
        // how: the operating-system table is looked for after the media region that wraps the runtime table, which a published README replaces with an image
        const anchor = region ? (rest[closing] as Line) : (table[table.length - 1] as Line)
        const systems = tableIn(region ? rest.slice(closing + 1) : rest)
        const declaredSystems = declaredSystemsTable(metadata?.['operatingSystems'])
        if (systems.length > 0) {
          compare(
            systems,
            declaredSystems,
            'The operating-system table does not match metadata.compatibility.operatingSystems in project.json. Run lint with --fix to regenerate it.'
          )
          return
        }
        const insertAt = anchor.offset + anchor.text.length
        context.report({
          start: anchor.offset,
          at: { line: anchor.row + 1, column: 0, endLine: anchor.row + 1, endColumn: anchor.text.length },
          message:
            'The Compatibility section carries no operating-system table after the runtime table and its media region. Run lint with --fix to add the one metadata.compatibility.operatingSystems declares.',
          fix: { start: insertAt, end: insertAt, text: `${eol}${eol}${declaredSystems.join(eol)}` },
        })
      },
    }
  },
})
