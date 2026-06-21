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
 * descending start order.
 *
 * Sorting descending before splicing is correctness-critical: editing from the
 * back forward keeps every remaining edit's offsets valid against the original
 * source, because an earlier (higher-offset) splice never shifts a later
 * (lower-offset) one. An off-by-one here re-introduces the chunk-corruption
 * class the prune passes exist to avoid. The input `edits` array is copied
 * before sorting, so the caller's order is left untouched.
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
