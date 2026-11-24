import { describe, expect, it } from '@hyperfrontend/testing'
import { addDays, daysBetween } from './dates'
import { CHUNK_DAYS } from './model'
import { splitSpan } from './plan'

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

  it('yields no chunk for a span that ends before it starts', () => {
    expect(splitSpan('2026-01-02', '2026-01-01', 10)).toEqual([])
  })
})
