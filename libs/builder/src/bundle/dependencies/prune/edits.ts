/** A single text replacement over the original chunk source. */
export interface Edit {
  /** Inclusive start offset. */
  start: number
  /** Exclusive end offset. */
  end: number
  /** Replacement text (empty string deletes the span). */
  text: string
}

/**
 * Applies text-range edits to a chunk source by splicing each span in
 * descending start order, so every edit's offsets stay valid against the
 * original source regardless of the order they are passed in. All offsets must
 * refer to the original `source`, and spans must not overlap. The input `edits`
 * array is copied before sorting, so the caller's order is left untouched.
 *
 * @param source - Original chunk source text.
 * @param edits - Edits to apply; their relative order does not matter.
 * @param collapseBlankLines - When `true`, runs of three or more newlines left
 * behind by whole-statement splices are collapsed to a single blank line so the
 * trimmed chunk stays readable. Defaults to `false`.
 * @returns The rewritten source.
 *
 * @example Deleting a statement and collapsing the blank run it leaves
 * ```typescript
 * applyEdits(source, [{ start, end, text: '' }], true)
 * ```
 */
export const applyEdits = (source: string, edits: Edit[], collapseBlankLines = false): string => {
  let code = source
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) code = `${code.slice(0, edit.start)}${edit.text}${code.slice(edit.end)}`
  // why: splicing whole statements leaves runs of blank lines; collapse them so the trimmed chunk stays readable.
  return collapseBlankLines ? code.replace(/\n{3,}/g, '\n\n') : code
}
