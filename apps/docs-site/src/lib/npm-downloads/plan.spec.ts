import { describe, expect, it } from 'vitest'
import { addDays, daysBetween } from './dates'
import { CHUNK_DAYS } from './model'
import { planFetches, splitSpan } from './plan'

const PACKAGE = '@hyperfrontend/features'

describe('splitSpan', () => {
  it('keeps a span within the chunk length whole', () => {
    expect(splitSpan('2026-01-01', '2026-01-10', 10)).toEqual([{ start: '2026-01-01', end: '2026-01-10' }])
  })

  it('cuts a span one day over the chunk length into two', () => {
    expect(splitSpan('2026-01-01', '2026-01-11', 10)).toEqual([
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-11', end: '2026-01-11' },
    ])
  })

  it('never produces a chunk longer than the limit over a long span', () => {
    const chunks = splitSpan('2015-01-10', '2026-09-10', CHUNK_DAYS)
    expect(chunks.every((chunk) => daysBetween(chunk.start, chunk.end).length <= CHUNK_DAYS)).toBe(true)
  })

  it('covers a long span exactly once with adjacent chunks', () => {
    const chunks = splitSpan('2015-01-10', '2026-09-10', CHUNK_DAYS)
    const joins = chunks.slice(1).every((chunk, index) => chunk.start === addDays(chunks[index].end, 1))
    expect({ first: chunks[0].start, last: chunks[chunks.length - 1].end, joins }).toEqual({
      first: '2015-01-10',
      last: '2026-09-10',
      joins: true,
    })
  })
})

describe('planFetches', () => {
  it('asks for a new package from the day it was published to the frontier', () => {
    expect(planFetches({ package: PACKAGE, created: '2026-06-28', frontier: '2026-09-10', stored: [] })).toEqual([
      { package: PACKAGE, start: '2026-06-28', end: '2026-09-10' },
    ])
  })

  it('asks nothing for a package published after the frontier', () => {
    expect(planFetches({ package: PACKAGE, created: '2026-09-11', frontier: '2026-09-10', stored: [] })).toEqual([])
  })

  it('asks only for the revalidation window when the history is complete', () => {
    const stored = daysBetween('2026-06-28', '2026-09-10')
    expect(planFetches({ package: PACKAGE, created: '2026-06-28', frontier: '2026-09-10', stored, revalidationDays: 7 })).toEqual([
      { package: PACKAGE, start: '2026-09-04', end: '2026-09-10' },
    ])
  })

  it('extends the window back to cover the days the frontier has moved past', () => {
    const stored = daysBetween('2026-06-28', '2026-09-08')
    expect(planFetches({ package: PACKAGE, created: '2026-06-28', frontier: '2026-09-10', stored, revalidationDays: 7 })).toEqual([
      { package: PACKAGE, start: '2026-09-04', end: '2026-09-10' },
    ])
  })

  it('fills a gap in the stored history as its own request', () => {
    const stored = [...daysBetween('2026-06-28', '2026-07-10'), ...daysBetween('2026-07-20', '2026-09-10')]
    expect(planFetches({ package: PACKAGE, created: '2026-06-28', frontier: '2026-09-10', stored, revalidationDays: 7 })).toEqual([
      { package: PACKAGE, start: '2026-07-11', end: '2026-07-19' },
      { package: PACKAGE, start: '2026-09-04', end: '2026-09-10' },
    ])
  })

  it('does not reach before the package existed when it is younger than the window', () => {
    expect(planFetches({ package: PACKAGE, created: '2026-09-08', frontier: '2026-09-10', stored: [], revalidationDays: 7 })).toEqual([
      { package: PACKAGE, start: '2026-09-08', end: '2026-09-10' },
    ])
  })

  it('never trusts one request with a history longer than a chunk', () => {
    const chunks = planFetches({ package: PACKAGE, created: '2015-01-10', frontier: '2026-09-10', stored: [], chunkDays: 500 })
    expect({
      count: chunks.length,
      longest: chunks.reduce((widest, c) => (daysBetween(c.start, c.end).length > widest ? daysBetween(c.start, c.end).length : widest), 0),
    }).toEqual({
      count: 9,
      longest: 500,
    })
  })

  it('re-reads the days that were still open at the previous refresh, however far the frontier has moved', () => {
    const stored = daysBetween('2026-06-28', '2026-08-15')
    expect(
      planFetches({
        package: PACKAGE,
        created: '2026-06-28',
        frontier: '2026-09-10',
        previousFrontier: '2026-08-15',
        stored,
        revalidationDays: 7,
      })
    ).toEqual([{ package: PACKAGE, start: '2026-08-09', end: '2026-09-10' }])
  })

  it('anchors the window on the current frontier when the previous one is not behind it', () => {
    const stored = daysBetween('2026-06-28', '2026-09-10')
    expect(
      planFetches({
        package: PACKAGE,
        created: '2026-06-28',
        frontier: '2026-09-10',
        previousFrontier: '2026-09-10',
        stored,
        revalidationDays: 7,
      })
    ).toEqual([{ package: PACKAGE, start: '2026-09-04', end: '2026-09-10' }])
  })

  it('merges a gap adjacent to the window into one request', () => {
    const stored = daysBetween('2026-06-28', '2026-08-31')
    expect(planFetches({ package: PACKAGE, created: '2026-06-28', frontier: '2026-09-10', stored, revalidationDays: 7 })).toEqual([
      { package: PACKAGE, start: '2026-09-01', end: '2026-09-10' },
    ])
  })
})
