import type { Day } from './dates'
import { addDays } from './dates'

/** An inclusive run of days. */
export interface Span {
  /** First day of the run */
  start: Day
  /** Last day of the run */
  end: Day
}

/**
 * Split an inclusive span into consecutive spans no longer than a chunk.
 *
 * npm's range endpoint answers at most eighteen months per request and says
 * nothing when it gives less, so a history is never asked for in one piece
 * once it could exceed that.
 *
 * @param start - First day of the span
 * @param end - Last day of the span
 * @param chunkDays - Longest span one chunk may cover
 * @returns The chunks in order, together covering exactly the span; none when the span ends before it starts
 *
 * @example A span one day longer than a chunk becomes two chunks
 * ```typescript
 * splitSpan('2026-01-01', '2026-01-03', 2)
 * // [{ start: '2026-01-01', end: '2026-01-02' }, { start: '2026-01-03', end: '2026-01-03' }]
 * ```
 */
export function splitSpan(start: Day, end: Day, chunkDays: number): Span[] {
  const chunks: Span[] = []
  let from = start
  while (from <= end) {
    const to = addDays(from, chunkDays - 1)
    chunks.push({ start: from, end: to < end ? to : end })
    from = addDays(to, 1)
  }
  return chunks
}
