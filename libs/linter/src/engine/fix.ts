/**
 * Applies fixes to a text: the ones that neither overlap nor touch an earlier one, in source
 * order, leaving the rest for the next pass.
 *
 * @module engine/fix
 */

import type { Fix } from './report'

/** What applying a round of fixes produced. */
export interface FixOutcome {
  /** The text after the fixes. */
  readonly text: string
  /** How many fixes were applied. */
  readonly applied: number
}

/**
 * Applies every fix that starts after the end of the fix applied before it; a fix starting where
 * the previous one ends waits for the next pass, as with the previous linter.
 *
 * @param text - The text before the fixes
 * @param fixes - The fixes offered, in any order
 * @returns The text after the fixes and how many applied
 *
 * @example Apply two fixes that do not overlap
 * ```ts
 * const fixes = [
 *   { start: 0, end: 3, text: 'let' },
 *   { start: 9, end: 10, text: '2' },
 * ]
 * applyFixes('var a = [1]', fixes)
 * // => { text: 'let a = [2]', applied: 2 }
 * ```
 */
export function applyFixes(text: string, fixes: readonly Fix[]): FixOutcome {
  const ordered = [...fixes].sort((a, b) => a.start - b.start || a.end - b.end)
  let output = ''
  let position = 0
  let last = -1
  let applied = 0
  for (const fix of ordered) {
    if (fix.start <= last) continue
    output += text.slice(position, fix.start) + fix.text
    position = fix.end
    last = fix.end
    applied += 1
  }
  return { text: output + text.slice(position), applied }
}
