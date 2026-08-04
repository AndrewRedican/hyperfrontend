import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

// note: Canonical machine-written marker lines; the region between them is machine-owned and safe to regenerate.
const BEGIN_LINE = '// <hf:feature> — managed by @hyperfrontend/features; safe to keep'
const END_LINE = '// </hf:feature>'

// note: A marker line starts its comment with the tag; a mid-comment mention of the token is not a marker.
const BEGIN_PATTERN = /^\/\/\s*<hf:feature>(?:\s|$)/
const END_PATTERN = /^\/\/\s*<\/hf:feature>(?:\s|$)/

// note: Directive-prologue members ('use strict', 'use client', ...) must stay above the inserted import.
const DIRECTIVE_PATTERN = /^(['"])use [^'"]+\1;?$/

/** Result of attempting to insert the marker-guarded glue import. */
export interface MarkerInsertion {
  /** The (possibly unchanged) entry-file content. */
  readonly content: string
  /** Whether the content changed (fresh insert, block regeneration, or marker repair). */
  readonly changed: boolean
}

/**
 * Builds the marker-guarded glue import block for an entry file.
 *
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The marker block, including a trailing newline.
 *
 * @example Building the block for a co-located glue module
 * ```typescript
 * buildMarkerBlock('./hyperfrontend.feature')
 * ```
 */
export function buildMarkerBlock(importSpecifier: string): string {
  return `${BEGIN_LINE}\n${glueImportLine(importSpecifier)}\n${END_LINE}\n`
}

/**
 * Renders the managed side-effect import of the scaffolded glue module.
 *
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The import statement line, without a trailing newline.
 */
function glueImportLine(importSpecifier: string): string {
  return `import '${importSpecifier}'`
}

/**
 * Collects the indexes of lines that are complete marker lines.
 *
 * @param lines - The entry-file lines.
 * @param pattern - The begin or end marker-line pattern.
 * @returns The matching line indexes, in order.
 */
function markerIndexes(lines: readonly string[], pattern: RegExp): readonly number[] {
  const indexes: number[] = []
  lines.forEach((line, index) => {
    if (pattern.test(line.trim())) indexes.push(index)
  })
  return indexes
}

/**
 * Finds where a fresh marker block belongs: after the shebang and after the last
 * directive-prologue member ('use strict', 'use client', ...), so both keep the
 * first positions their semantics require. Comments and blank lines only move
 * the insertion point when a directive follows them.
 *
 * @param lines - The entry-file lines.
 * @returns The line index to insert the block at.
 */
function insertionIndex(lines: readonly string[]): number {
  let index = 0
  let cursor = 0
  let inBlockComment = false
  for (const raw of lines) {
    const line = raw.trim()
    const isFirst = cursor === 0
    cursor += 1
    if (isFirst && raw.startsWith('#!')) {
      index = cursor
      continue
    }
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false
      continue
    }
    if (line === '') continue
    if (DIRECTIVE_PATTERN.test(line)) {
      index = cursor
      continue
    }
    if (line.startsWith('//')) continue
    if (line.startsWith('/*')) {
      inBlockComment = !line.includes('*/')
      continue
    }
    break
  }
  return index
}

/**
 * Inserts a fresh marker block below the shebang and directive prologue.
 *
 * @param lines - The entry-file lines.
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The changed content.
 */
function insertBlock(lines: readonly string[], importSpecifier: string): MarkerInsertion {
  const index = insertionIndex(lines)
  const content = [...lines.slice(0, index), BEGIN_LINE, glueImportLine(importSpecifier), END_LINE, '', ...lines.slice(index)].join('\n')
  return { content, changed: true }
}

/**
 * Regenerates the machine-owned content between the two marker lines.
 *
 * @param source - The original entry-file content.
 * @param lines - The entry-file lines.
 * @param begin - Index of the begin marker line.
 * @param end - Index of the end marker line.
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The regenerated content, reported unchanged when already canonical.
 * @throws {Error} When the end marker precedes the begin marker.
 */
function regenerateBlock(source: string, lines: readonly string[], begin: number, end: number, importSpecifier: string): MarkerInsertion {
  if (end < begin) {
    throw createError(
      `the '${END_LINE}' end marker appears before its '// <hf:feature>' begin marker — reorder the two marker lines so the begin marker comes first, then re-run.`
    )
  }
  const importLine = glueImportLine(importSpecifier)
  const interior = lines.slice(begin + 1, end)
  if (interior.length === 1 && interior[0] === importLine) {
    return { content: source, changed: false }
  }
  return { content: [...lines.slice(0, begin + 1), importLine, ...lines.slice(end)].join('\n'), changed: true }
}

/**
 * Repairs a block that lost its end marker, when the managed import directly
 * below the begin marker makes the repair unambiguous.
 *
 * @param lines - The entry-file lines.
 * @param begin - Index of the begin marker line.
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The repaired content.
 * @throws {Error} When the line below the begin marker is not the managed import.
 */
function repairMissingEnd(lines: readonly string[], begin: number, importSpecifier: string): MarkerInsertion {
  const [below] = lines.slice(begin + 1, begin + 2)
  if (below !== glueImportLine(importSpecifier)) {
    throw createError(
      `found a '// <hf:feature>' begin marker without a matching '${END_LINE}' end marker — add a '${END_LINE}' line directly after the managed glue import, or delete the begin marker line, then re-run.`
    )
  }
  return { content: [...lines.slice(0, begin + 2), END_LINE, ...lines.slice(begin + 2)].join('\n'), changed: true }
}

/**
 * Repairs a block that lost its begin marker, when the managed import directly
 * above the end marker makes the repair unambiguous.
 *
 * @param lines - The entry-file lines.
 * @param end - Index of the end marker line.
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The repaired content.
 * @throws {Error} When the line above the end marker is not the managed import.
 */
function repairMissingBegin(lines: readonly string[], end: number, importSpecifier: string): MarkerInsertion {
  const [above] = lines.slice(end - 1, end)
  if (above !== glueImportLine(importSpecifier)) {
    throw createError(
      `found a '${END_LINE}' end marker without a matching '// <hf:feature>' begin marker — add a '// <hf:feature>' begin marker line directly above the managed glue import, or delete the end marker line, then re-run.`
    )
  }
  return { content: [...lines.slice(0, end - 1), BEGIN_LINE, ...lines.slice(end - 1)].join('\n'), changed: true }
}

/**
 * Inserts or maintains the marker-guarded glue import in an entry file, idempotently.
 *
 * The block between the begin and end marker lines is machine-owned: a fresh file
 * gains the block below its shebang and directive prologue, a wired file has the
 * content between its markers regenerated in place, and a file that lost exactly
 * one marker line beside the managed import is repaired deterministically.
 * Everything outside the markers is user-owned and never touched — deleting the
 * whole block reverses the mutation. A mere mention of the marker token inside
 * another comment is not treated as a marker.
 *
 * @param source - The current entry-file content.
 * @param importSpecifier - The relative specifier of the scaffolded glue module.
 * @returns The resulting content and whether it changed.
 * @throws {Error} When the marker block is damaged beyond unambiguous repair.
 *
 * @example Wiring the glue import into an app entry
 * ```typescript
 * const { content, changed } = insertFeatureImport(entrySource, './hyperfrontend.feature')
 * ```
 */
export function insertFeatureImport(source: string, importSpecifier: string): MarkerInsertion {
  const lines = source.split('\n')
  const begins = markerIndexes(lines, BEGIN_PATTERN)
  const ends = markerIndexes(lines, END_PATTERN)
  if (begins.length > 1 || ends.length > 1) {
    throw createError(
      "found more than one '// <hf:feature>' marker block — keep exactly one begin/end marker pair, delete the extra marker lines, then re-run."
    )
  }
  const [begin] = begins
  const [end] = ends
  if (begin !== undefined && end !== undefined) return regenerateBlock(source, lines, begin, end, importSpecifier)
  if (begin !== undefined) return repairMissingEnd(lines, begin, importSpecifier)
  if (end !== undefined) return repairMissingBegin(lines, end, importSpecifier)
  return insertBlock(lines, importSpecifier)
}
