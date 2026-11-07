/**
 * Text edits over one upstream declaration: the rewrites that turn it into a declaration the
 * generated file can carry, applied without disturbing what is kept.
 *
 * @module types-extract/edits
 */

import ts from 'typescript'

/** One replacement of a span of text; an insertion has an empty span. */
export interface Edit {
  /** The span's start offset. */
  readonly start: number
  /** The span's end offset. */
  readonly end: number
  /** The text written in its place. */
  readonly text: string
}

/**
 * Applies edits to a text. A replacement nested inside another replacement's span is dropped, since
 * the outer one already decides that text, and so is a repeat of the same span; edits are otherwise
 * expected not to overlap. An insertion is always kept.
 *
 * @param text - The text the edits were computed over
 * @param edits - The edits, in any order
 * @returns The edited text
 */
export function applyEdits(text: string, edits: readonly Edit[]): string {
  const isInsertion = (edit: Edit): boolean => edit.start === edit.end
  // how: by start; at one start an insertion goes first so it lands before the replacement, then the longer span so the nested ones follow it.
  const sorted = [...edits].sort((a, b) => a.start - b.start || (isInsertion(a) ? -1 : isInsertion(b) ? 1 : b.end - a.end))
  const kept: Edit[] = []
  let outer: Edit | undefined
  for (const edit of sorted) {
    if (!isInsertion(edit) && outer !== undefined && edit.start >= outer.start && edit.end <= outer.end) continue
    kept.push(edit)
    if (!isInsertion(edit)) outer = edit
  }
  let result = text
  for (let index = kept.length - 1; index >= 0; index -= 1) {
    const edit = kept[index] as Edit
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`
  }
  return result
}

/**
 * The edits within a span, shifted so the span starts at zero.
 *
 * @param edits - All edits
 * @param start - The span's start
 * @param end - The span's end
 * @returns The subset lying in the span, with offsets made relative to its start
 */
export function editsWithin(edits: readonly Edit[], start: number, end: number): Edit[] {
  return edits
    .filter((edit) => edit.start >= start && edit.end <= end)
    .map((edit) => ({ start: edit.start - start, end: edit.end - start, text: edit.text }))
}

/**
 * The edits that make a declaration exported and nothing else: `export` added when absent,
 * `declare` and `default` removed.
 *
 * @param node - The declaration made exported
 * @param sourceFile - Its file
 * @returns The insertions and removals that adjust its modifiers
 */
export function exportEdits(node: ts.Statement, sourceFile: ts.SourceFile): Edit[] {
  const modifiers = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : []
  const edits: Edit[] = []
  if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
    edits.push({ start: node.getStart(sourceFile), end: node.getStart(sourceFile), text: 'export ' })
  for (const modifier of modifiers) {
    if (modifier.kind === ts.SyntaxKind.DeclareKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword) {
      const start = modifier.getStart(sourceFile)
      edits.push({ start, end: sourceFile.text[modifier.end] === ' ' ? modifier.end + 1 : modifier.end, text: '' })
    }
  }
  return edits
}

/**
 * The edit that rewrites a heritage clause without some of its types, keeping the edits inside
 * the types that stay; the whole clause goes when nothing stays.
 *
 * @param clause - The heritage clause rewritten
 * @param removed - The types dropped from it
 * @param edits - All edits, from which those inside the kept types are taken
 * @param sourceFile - The clause's file
 * @returns One replacement covering the whole clause
 */
export function heritageEdit(
  clause: ts.HeritageClause,
  removed: ReadonlySet<ts.Node>,
  edits: readonly Edit[],
  sourceFile: ts.SourceFile
): Edit {
  const text = sourceFile.text
  const kept = clause.types.filter((type) => !removed.has(type))
  const start = clause.getStart(sourceFile)
  if (kept.length === 0) return { start: text[start - 1] === ' ' ? start - 1 : start, end: clause.end, text: '' }
  const token = clause.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements'
  const types = kept.map((type) =>
    applyEdits(text.slice(type.getStart(sourceFile), type.end), editsWithin(edits, type.getStart(sourceFile), type.end))
  )
  return { start, end: clause.end, text: `${token} ${types.join(', ')}` }
}

/**
 * A declaration's text with the indentation of its first line removed from every line, so a
 * declaration taken from inside a namespace sits at the top level.
 *
 * @param text - The declaration's text, starting at the declaration
 * @param indentation - The whitespace before the declaration on its first line
 * @returns The dedented text
 */
export function dedent(text: string, indentation: string): string {
  if (indentation === '') return text
  return text
    .split(/\r?\n/)
    .map((line, index) => (index > 0 && line.startsWith(indentation) ? line.slice(indentation.length) : line))
    .join('\n')
}

/**
 * The whitespace between the start of a declaration's line and the declaration.
 *
 * @param sourceFile - The file the declaration is in
 * @param start - The declaration's start offset
 * @returns The indentation, or an empty string when something else precedes the declaration on its line
 */
export function indentationBefore(sourceFile: ts.SourceFile, start: number): string {
  const lineStart = sourceFile.text.lastIndexOf('\n', start - 1) + 1
  const before = sourceFile.text.slice(lineStart, start)
  return /^[ \t]*$/.test(before) ? before : ''
}
