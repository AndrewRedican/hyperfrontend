import type { Day } from './dates'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { addDays, daysBetween, daysInclusive } from './dates'
import { CHUNK_DAYS, REVALIDATION_DAYS } from './model'

/** One range request: a package and the inclusive span of days to ask for. */
export interface FetchChunk {
  /** Full npm package name */
  package: string
  /** First day asked for */
  start: Day
  /** Last day asked for */
  end: Day
}

/** What a plan is built from. */
export interface PlanInput {
  /** Full npm package name */
  package: string
  /** The day the package was first published */
  created: Day
  /** The newest day npm has finished counting */
  frontier: Day
  /** The frontier at the previous refresh, so the days that were still open then are read again now; omitted on the first run */
  previousFrontier?: Day
  /** Days already on disk for this package */
  stored: readonly Day[]
  /** Days behind the frontier still open to revision; defaults to {@link REVALIDATION_DAYS} */
  revalidationDays?: number
  /** Longest span one request may ask for; defaults to {@link CHUNK_DAYS} */
  chunkDays?: number
}

/**
 * Split an inclusive span into consecutive spans no longer than a chunk.
 *
 * @param start - First day of the span
 * @param end - Last day of the span
 * @param chunkDays - Longest span one chunk may cover
 * @returns The chunks in order, together covering exactly the span
 *
 * @example A span one day longer than a chunk becomes two chunks
 * ```typescript
 * splitSpan('2026-01-01', '2026-01-03', 2)
 * // [{ start: '2026-01-01', end: '2026-01-02' }, { start: '2026-01-03', end: '2026-01-03' }]
 * ```
 */
export function splitSpan(start: Day, end: Day, chunkDays: number): Array<Pick<FetchChunk, 'start' | 'end'>> {
  const chunks: Array<Pick<FetchChunk, 'start' | 'end'>> = []
  let from = start
  while (from <= end) {
    const to = addDays(from, chunkDays - 1)
    chunks.push({ start: from, end: to < end ? to : end })
    from = addDays(to, 1)
  }
  return chunks
}

/**
 * Decide which days to ask npm about for one package.
 *
 * The days wanted are every day from the package's first day to the frontier
 * that is not already stored, plus the revalidation window whether stored or
 * not. The window is anchored on the previous refresh's frontier rather than
 * on today's: a day that was still open to revision when it was last stored
 * is read again now, however far the frontier has moved since, and only a
 * day that has been read at least once from a safe distance behind the
 * frontier is left alone. Wanted days are coalesced into contiguous
 * spans and each span is cut to the chunk length, so a package with a
 * complete history costs one request covering the window, a brand-new
 * package costs one request covering its whole life, and a package whose
 * history has grown past what one request may cover is fetched in several
 * bounded requests that are each checked against what they asked for.
 *
 * A gap in the stored days is filled the same way, so a dataset that was
 * interrupted or hand-edited heals on the next refresh rather than being
 * rebuilt from nothing.
 *
 * @param input - The package, its bounds, and what is already on disk
 * @returns The requests to make, in chronological order; empty when the stored days already cover everything
 *
 * @example A package with an up-to-date history asks only for its window
 * ```typescript
 * planFetches({
 *   package: '@hyperfrontend/features',
 *   created: '2026-06-28',
 *   frontier: '2026-09-10',
 *   stored: daysBetween('2026-06-28', '2026-09-10'),
 * })
 * // [{ package: '@hyperfrontend/features', start: '2026-09-04', end: '2026-09-10' }]
 * ```
 */
export function planFetches(input: PlanInput): FetchChunk[] {
  const revalidationDays = input.revalidationDays ?? REVALIDATION_DAYS
  const chunkDays = input.chunkDays ?? CHUNK_DAYS
  if (input.frontier < input.created) return []

  const stored = createSet(input.stored)
  const anchor = input.previousFrontier !== undefined && input.previousFrontier < input.frontier ? input.previousFrontier : input.frontier
  // why: the window is counted back from the anchor, but a package younger than the window has nothing to revalidate before it existed
  const windowStart = max(0, daysInclusive(input.created, anchor) - revalidationDays)
  const wanted = daysBetween(input.created, input.frontier).filter((day, index) => index >= windowStart || !stored.has(day))

  const spans: Array<Pick<FetchChunk, 'start' | 'end'>> = []
  for (const day of wanted) {
    const last = spans[spans.length - 1]
    if (last !== undefined && addDays(last.end, 1) === day) {
      last.end = day
    } else {
      spans.push({ start: day, end: day })
    }
  }

  return spans.flatMap((span) => splitSpan(span.start, span.end, chunkDays)).map((span) => ({ package: input.package, ...span }))
}
