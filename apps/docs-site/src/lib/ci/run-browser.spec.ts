import type { RunIndex } from './model'
import { describe, expect, it } from 'vitest'
import { githubRun } from './__test-utils__/fixtures'
import {
  DEFAULT_QUERY,
  PAGE_SIZE,
  durationOf,
  matchesText,
  mergeRuns,
  newestRun,
  outcomeRank,
  passesFilter,
  queryRuns,
} from './run-browser'

const index: RunIndex = {
  schema: 1,
  runs: [
    {
      id: 2,
      number: 11,
      attempt: 1,
      sha: 'fedcba0987654321',
      ref: 'refs/heads/main',
      event: 'push',
      url: 'https://example.test/runs/2',
      recordedAt: 1_700_000_900_000,
      mode: 'affected',
      main: true,
      environments: ['linux', 'windows'],
      chains: 3,
      tasks: 7,
      outcome: 'failure',
    },
    {
      id: 1,
      number: 10,
      attempt: 1,
      sha: 'abcdef1234567890',
      ref: 'refs/heads/main',
      event: 'push',
      url: 'https://example.test/runs/1',
      recordedAt: 1_699_999_000_000,
      mode: 'all',
      main: true,
      environments: ['linux'],
      chains: 2,
      tasks: 4,
      outcome: 'success',
    },
  ],
}

const listed = [
  githubRun({ status: 'completed', conclusion: 'failure', updated_at: '2023-11-14T22:30:00.000Z' }),
  githubRun({
    id: 3,
    run_number: 12,
    path: '.github/workflows/ci-pr.yml',
    head_branch: 'feature',
    event: 'pull_request',
    created_at: '2023-11-14T23:00:00.000Z',
    run_started_at: '2023-11-14T23:00:00.000Z',
  }),
]

describe('mergeRuns', () => {
  it('lists every run once, newest first', () => {
    expect(mergeRuns(index, listed).map((run) => run.id)).toEqual([3, 2, 1])
  })

  it('joins a record with its listing', () => {
    expect(mergeRuns(index, listed)[1]).toEqual(
      expect.objectContaining({
        recorded: true,
        listed: true,
        tasks: 7,
        outcome: 'failure',
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_001_000_000,
        title: 'feat: something',
      })
    )
  })

  it('orders a record alone by its recording', () => {
    expect(mergeRuns(index, listed)[2]).toEqual(
      expect.objectContaining({ recorded: true, listed: false, at: 1_699_999_000_000, startedAt: null })
    )
  })

  it('keeps a listing alone with what GitHub knows', () => {
    expect(mergeRuns(index, listed)[0]).toEqual(
      expect.objectContaining({ workflow: 'pr', status: 'in_progress', recorded: false, tasks: null, branch: 'feature' })
    )
  })

  it('lists nothing before either source is read', () => {
    expect(mergeRuns(null, null)).toEqual([])
  })
})

describe('newestRun', () => {
  it('picks the newest', () => {
    expect(newestRun(mergeRuns(index, listed))?.id).toBe(3)
  })

  it('picks nothing from nothing', () => {
    expect(newestRun([])).toBeNull()
  })
})

describe('queryRuns', () => {
  const runs = mergeRuns(index, listed)

  it('keeps the failed runs', () => {
    expect(queryRuns(runs, { ...DEFAULT_QUERY, filter: 'failed' }).rows.map((run) => run.id)).toEqual([2])
  })

  it('keeps the active runs', () => {
    expect(queryRuns(runs, { ...DEFAULT_QUERY, filter: 'active' }).rows.map((run) => run.id)).toEqual([3])
  })

  it('finds text in the branch', () => {
    expect(queryRuns(runs, { ...DEFAULT_QUERY, text: 'FEAT' }).rows.map((run) => run.id)).toEqual([3, 2])
  })

  it('orders by number ascending', () => {
    expect(queryRuns(runs, { ...DEFAULT_QUERY, sort: 'number', descending: false }).rows.map((run) => run.number)).toEqual([10, 11, 12])
  })

  it('orders by outcome with failures first', () => {
    expect(queryRuns(runs, { ...DEFAULT_QUERY, sort: 'outcome', descending: false }).rows.map((run) => run.id)).toEqual([2, 3, 1])
  })

  it('orders by duration with unknown durations last', () => {
    expect(queryRuns(runs, { ...DEFAULT_QUERY, sort: 'duration', descending: true }).rows.map((run) => run.id)).toEqual([2, 3, 1])
  })

  it('pages the rows', () => {
    const many = [...new Array(25).keys()].map((offset) => ({
      ...(runs[0] as (typeof runs)[number]),
      id: 100 + offset,
      number: 100 + offset,
      at: offset,
    }))
    expect(queryRuns(many, { ...DEFAULT_QUERY, page: 2 })).toEqual(
      expect.objectContaining({ total: 25, pages: 3, page: 2, rows: expect.any(Array) })
    )
  })

  it('holds a page to the last one', () => {
    expect(queryRuns(runs, { ...DEFAULT_QUERY, page: 9 }).page).toBe(0)
  })

  it('fills a page with at most the page size', () => {
    const many = [...new Array(25).keys()].map((offset) => ({ ...(runs[0] as (typeof runs)[number]), id: 100 + offset, at: offset }))
    expect(queryRuns(many, DEFAULT_QUERY).rows).toHaveLength(PAGE_SIZE)
  })
})

describe('helpers', () => {
  it('ranks an active run between a cancellation and an incomplete record', () => {
    expect(mergeRuns(index, listed).map(outcomeRank)).toEqual([2, 0, 5])
  })

  it('reads a duration from the start and end', () => {
    expect(durationOf(mergeRuns(index, listed)[1] as never)).toBe(1_000_000)
  })

  it('passes the ci filter for a main workflow run', () => {
    expect(passesFilter(mergeRuns(index, listed)[1] as never, 'ci')).toBe(true)
  })

  it('matches a run number with its hash', () => {
    expect(matchesText(mergeRuns(index, listed)[1] as never, '#11')).toBe(true)
  })
})
