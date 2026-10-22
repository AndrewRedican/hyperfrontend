/**
 * Several edits of one text folded into the single replacement a report carries: the span from
 * the first edit's start to the last edit's end, with the text between the edits kept.
 *
 * @module rules/typescript/shared/edits
 */

import type { Fix } from '../../../engine/report.ts'

/**
 * Folds edits that do not overlap into one replacement.
 *
 * @param text - The text the edits apply to
 * @param edits - The edits, in any order; an insertion has `start` equal to `end`
 * @returns One replacement covering them all
 */
export function mergeEdits(text: string, edits: readonly Fix[]): Fix {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end)
  const start = (sorted[0] as Fix).start
  let replacement = ''
  let at = start
  for (const edit of sorted) {
    replacement += text.slice(at, edit.start) + edit.text
    at = edit.end
  }
  return { start, end: at, text: replacement }
}
