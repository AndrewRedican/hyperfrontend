import type { LibraryFacts } from './library-facts'
import type { TextLines } from './lines'
import { posix } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { indentOf, joinLines, splitLines } from './lines'

/**
 * The comment that opens the list of active libraries, once in the path
 * filters and once in the matrix script. Both lists are appended to, which is
 * what the comment above them asks for.
 */
const ACTIVE_MARKER = '# ACTIVE LIBRARIES:'

/**
 * The filter that forces every library through CI when the workflow itself
 * changes. It closes the filter list, so a library is inserted before it.
 */
const CLOSING_FILTER = 'workflow-changed'

/**
 * The lines that open the two active-library lists.
 *
 * @param lines - The workflow's lines
 * @returns The index of the filter list's marker and of the matrix list's marker
 * @throws {Error} When the workflow does not carry both markers
 */
function activeMarkers(lines: readonly string[]): [number, number] {
  const found: number[] = []
  lines.forEach((line, index) => {
    if (line.trim() === ACTIVE_MARKER) found.push(index)
  })
  if (found.length < 2) {
    throw createError(`ci-libraries.yml must open both its filter list and its matrix list with "${ACTIVE_MARKER}", found ${found.length}`)
  }
  return [found[0] as number, found[1] as number]
}

/**
 * The name a line declares when it is a filter entry at the given indentation.
 *
 * @param line - One line of the file
 * @param indent - The indentation filter entries sit at
 * @returns The filter name, or null for any other line
 */
function filterNameOf(line: string, indent: string): string | null {
  if (!line.startsWith(indent) || line.startsWith(`${indent} `) || !line.endsWith(':')) return null
  return line.slice(indent.length, -1)
}

/**
 * Whether the workflow already filters on a library's path.
 *
 * @param content - The workflow
 * @param coverageFlag - The filter name, `data-utils`
 * @param projectRoot - Workspace-relative project root, `libs/utils/data`
 * @returns True when a filter of that name lists the project's path
 */
export function hasPathFilter(content: string, coverageFlag: string, projectRoot: string): boolean {
  const { lines } = splitLines(content)
  const pattern = `'${posix.join(projectRoot, '**')}'`
  for (let index = 0; index < lines.length; index++) {
    if ((lines[index] as string).trim() !== `${coverageFlag}:`) continue
    for (let path = index + 1; path < lines.length && (lines[path] as string).trimStart().startsWith('- '); path++) {
      if ((lines[path] as string).includes(pattern)) return true
    }
  }
  return false
}

/**
 * Whether the workflow's matrix already includes a library.
 *
 * @param content - The workflow
 * @param facts - What was derived from the package's project
 * @returns True when an uncommented `add_if_changed` line names the filter, project, path and flag
 */
export function hasMatrixEntry(content: string, facts: LibraryFacts): boolean {
  const tokens = [`filter.outputs.${facts.coverageFlag}`, `"${facts.projectName}"`, `"${facts.projectRoot}"`, `"${facts.coverageFlag}"`]
  return splitLines(content).lines.some((line) => {
    const trimmed = line.trim()
    return trimmed.startsWith('add_if_changed') && tokens.every((token) => trimmed.includes(token))
  })
}

/**
 * Add the library's path filter at the end of the active filters.
 *
 * @param text - The workflow's lines, changed in place
 * @param facts - What was derived from the package's project
 */
function addPathFilter(text: TextLines, facts: LibraryFacts): void {
  const [marker] = activeMarkers(text.lines)
  const indent = indentOf(text.lines[marker] as string)
  let index = marker + 1
  let insertAt = -1
  while (index < text.lines.length) {
    const line = text.lines[index] as string
    if (line.startsWith(`${indent}  - `)) {
      index++
      continue
    }
    const name = filterNameOf(line, indent)
    if (name === null) break
    if (name === CLOSING_FILTER) {
      insertAt = index
      break
    }
    index++
  }
  if (insertAt === -1) insertAt = index
  text.lines.splice(insertAt, 0, `${indent}${facts.coverageFlag}:`, `${indent}  - '${posix.join(facts.projectRoot, '**')}'`)
}

/**
 * Add the library's matrix entry after the last active entry.
 *
 * @param text - The workflow's lines, changed in place
 * @param facts - What was derived from the package's project
 */
function addMatrixEntry(text: TextLines, facts: LibraryFacts): void {
  const [, marker] = activeMarkers(text.lines)
  const indent = indentOf(text.lines[marker] as string)
  let index = marker + 1
  while (index < text.lines.length && (text.lines[index] as string).startsWith(`${indent}add_if_changed `)) index++
  text.lines.splice(
    index,
    0,
    `${indent}add_if_changed "\${{ steps.filter.outputs.${facts.coverageFlag} }}" "${facts.projectName}" "${facts.projectRoot}" "${facts.coverageFlag}"`
  )
}

/**
 * Register a library in the libraries workflow: a path filter so a change to
 * it runs CI, and a matrix entry so that run builds, tests and reports it.
 *
 * Each part is written only when it is missing, so a workflow that already
 * knows the library comes back unchanged.
 *
 * @param content - `.github/workflows/ci-libraries.yml`
 * @param facts - What was derived from the package's project
 * @returns The workflow with both parts present
 * @throws {Error} When the workflow does not carry the markers the lists are found by
 *
 * @example
 * ```typescript
 * const updated = registerLibraryInCiLibraries(readFileSync(workflow, 'utf-8'), facts)
 * ```
 */
export function registerLibraryInCiLibraries(content: string, facts: LibraryFacts): string {
  const text = splitLines(content)
  if (!hasPathFilter(content, facts.coverageFlag, facts.projectRoot)) addPathFilter(text, facts)
  if (!hasMatrixEntry(content, facts)) addMatrixEntry(text, facts)
  return joinLines(text)
}
