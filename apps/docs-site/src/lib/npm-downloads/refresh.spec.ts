import type { NpmClient } from './client'
import type { Day } from './dates'
import type { DailyDownloads, DatasetManifest } from './model'
import type { RangeRequest } from './validate'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commitDataset, readDataset } from './dataset'
import { daysBetween, daysInclusive } from './dates'
import { NpmStatsError } from './model'
import { isRefreshDue, refreshDownloads } from './refresh'

const FEATURES = '@hyperfrontend/features'
const NEXUS = '@hyperfrontend/nexus'

/** Noon UTC on the day after the frontier the fixtures answer with. */
const NOW = Date.parse('2026-09-12T12:00:00.000Z')

/** What the fixture registry knows about each package. */
const CREATED: Record<string, Day> = { [FEATURES]: '2026-06-28', [NEXUS]: '2026-02-15' }

/** A fixture npm: deterministic counts, a fixed frontier, and a log of every request. */
interface FixtureNpm extends NpmClient {
  /** Every range request made, in order */
  ranges: RangeRequest[]
  /** How many creation-day lookups were made */
  createdLookups: number
}

/**
 * The count the fixture npm reports for a day: the day of the month, so a
 * corrected count is easy to tell from an original.
 *
 * @param day - The day being counted
 * @param offset - Added to every count, to simulate a revision
 * @returns The fixture's count for that day
 */
function countFor(day: Day, offset: number): number {
  return Number(day.slice(8, 10)) + offset
}

/**
 * A fixture npm.
 *
 * @param frontier - The newest day it has counted
 * @param offset - Added to every count it reports
 * @param failRangeWith - A failure to throw from the first range request, or null for none
 * @returns The client
 */
function fixtureNpm(frontier: Day, offset = 0, failRangeWith: NpmStatsError | null = null): FixtureNpm {
  const ranges: RangeRequest[] = []
  let requestCount = 0
  let createdLookups = 0
  return {
    ranges,
    get createdLookups() {
      return createdLookups
    },
    get requestCount() {
      return requestCount
    },
    fetchLastDay: () => {
      requestCount += 1
      return Promise.resolve(frontier)
    },
    fetchCreated: (packageName) => {
      requestCount += 1
      createdLookups += 1
      return Promise.resolve(CREATED[packageName])
    },
    fetchRange: (request) => {
      requestCount += 1
      ranges.push(request)
      if (failRangeWith !== null && ranges.length === 1) return Promise.reject(failRangeWith)
      return Promise.resolve(
        daysBetween(request.start, request.end).map(
          (day): DailyDownloads => ({ package: request.package, day, downloads: countFor(day, offset) })
        )
      )
    },
  }
}

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'npm-refresh-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('isRefreshDue', () => {
  it('is due before any refresh has run', () => {
    expect(isRefreshDue(null, NOW)).toBe(true)
  })

  it('is due when the last refresh ran on an earlier UTC day', () => {
    expect(isRefreshDue({ refreshedAt: '2026-09-11T23:59:00.000Z' } as DatasetManifest, NOW)).toBe(true)
  })

  it('is not due when the last refresh ran earlier the same UTC day', () => {
    expect(isRefreshDue({ refreshedAt: '2026-09-12T00:21:00.000Z' } as DatasetManifest, NOW)).toBe(false)
  })
})

describe('refreshDownloads', () => {
  it('collects a new package from its first published day to the frontier', async () => {
    const npm = fixtureNpm('2026-09-10')
    await refreshDownloads({ dir, packages: [FEATURES], client: npm, now: NOW })
    expect(npm.ranges).toEqual([{ package: FEATURES, start: '2026-06-28', end: '2026-09-10' }])
  })

  it('writes the collected days and the manifest', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const dataset = readDataset(dir)
    expect({
      files: readdirSync(dir).sort(),
      days: dataset.days.get(FEATURES)?.length,
      manifest: dataset.manifest,
    }).toEqual({
      files: ['features.ndjson', 'manifest.json'],
      days: daysInclusive('2026-06-28', '2026-09-10'),
      manifest: {
        version: 1,
        refreshedAt: '2026-09-12T12:00:00.000Z',
        frontier: '2026-09-10',
        revalidationDays: 7,
        packages: { [FEATURES]: { created: '2026-06-28' } },
      },
    })
  })

  it('fetches a several-month-old package in bounded chunks rather than one request', async () => {
    const npm = fixtureNpm('2026-09-10')
    await refreshDownloads({ dir, packages: [NEXUS], client: npm, now: NOW })
    expect(npm.ranges).toEqual([{ package: NEXUS, start: '2026-02-15', end: '2026-09-10' }])
  })

  it('never asks one request for more days than the chunk cap once a history exceeds it', async () => {
    const npm = fixtureNpm('2028-01-01')
    await refreshDownloads({ dir, packages: [NEXUS], client: npm, now: Date.parse('2028-01-02T12:00:00.000Z') })
    expect({
      requests: npm.ranges.length,
      longest: Math.max(...npm.ranges.map((range) => daysInclusive(range.start, range.end))),
      stored: readDataset(dir).days.get(NEXUS)?.length,
    }).toEqual({ requests: 2, longest: 500, stored: daysInclusive('2026-02-15', '2028-01-01') })
  })

  it('skips a refresh made earlier the same day', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const later = fixtureNpm('2026-09-11')
    const result = await refreshDownloads({ dir, packages: [FEATURES], client: later, now: NOW + 3_600_000 })
    expect({ outcome: result.outcome, requests: later.requestCount }).toEqual({ outcome: 'not-due', requests: 0 })
  })

  it('runs anyway when forced', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const later = fixtureNpm('2026-09-11')
    const result = await refreshDownloads({ dir, packages: [FEATURES], client: later, now: NOW + 3_600_000, force: true })
    expect(result.outcome).toBe('refreshed')
  })

  it('asks only for the revalidation window when the history is already complete', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const nextDay = fixtureNpm('2026-09-10')
    await refreshDownloads({ dir, packages: [FEATURES], client: nextDay, now: NOW + 86_400_000 })
    expect(nextDay.ranges).toEqual([{ package: FEATURES, start: '2026-09-04', end: '2026-09-10' }])
  })

  it('does not look up a creation day it already knows', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const nextDay = fixtureNpm('2026-09-10')
    await refreshDownloads({ dir, packages: [FEATURES], client: nextDay, now: NOW + 86_400_000 })
    expect(nextDay.createdLookups).toBe(0)
  })

  it('writes nothing when every answer matches what is stored', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const before = readFileSync(join(dir, 'manifest.json'), 'utf8')
    const result = await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW + 86_400_000 })
    expect({ outcome: result.outcome, changed: result.changed, manifest: readFileSync(join(dir, 'manifest.json'), 'utf8') }).toEqual({
      outcome: 'up-to-date',
      changed: [],
      manifest: before,
    })
  })

  it('appends the days the frontier has moved past', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const result = await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-12'), now: NOW + 2 * 86_400_000 })
    expect({ outcome: result.outcome, changed: result.changed, last: readDataset(dir).days.get(FEATURES)?.at(-1) }).toEqual({
      outcome: 'refreshed',
      changed: ['features.ndjson', 'manifest.json'],
      last: { package: FEATURES, day: '2026-09-12', downloads: 12 },
    })
  })

  it('takes a corrected count inside the revalidation window and keeps the finalized days', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10', 100), now: NOW + 86_400_000 })
    const days = readDataset(dir).days.get(FEATURES) ?? []
    expect({
      finalized: days.find((d) => d.day === '2026-09-03')?.downloads,
      revalidated: days.find((d) => d.day === '2026-09-04')?.downloads,
    }).toEqual({
      finalized: 3,
      revalidated: 104,
    })
  })

  it('fills a partial cached history from where it stops', async () => {
    const partial = daysBetween('2026-06-28', '2026-08-15').map((day): DailyDownloads => ({ package: FEATURES, day, downloads: 1 }))
    commitDataset(
      dir,
      {
        version: 1,
        refreshedAt: '2026-08-16T00:00:00.000Z',
        frontier: '2026-08-15',
        revalidationDays: 7,
        packages: { [FEATURES]: { created: '2026-06-28' } },
      },
      new Map([[FEATURES, partial]])
    )
    const npm = fixtureNpm('2026-09-10')
    await refreshDownloads({ dir, packages: [FEATURES], client: npm, now: NOW })
    expect({ ranges: npm.ranges, stored: readDataset(dir).days.get(FEATURES)?.length }).toEqual({
      ranges: [{ package: FEATURES, start: '2026-08-09', end: '2026-09-10' }],
      stored: daysInclusive('2026-06-28', '2026-09-10'),
    })
  })

  it('tracks a newly published package on the next refresh without touching the others', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const npm = fixtureNpm('2026-09-10')
    const result = await refreshDownloads({ dir, packages: [FEATURES, NEXUS], client: npm, now: NOW + 86_400_000 })
    expect({ changed: result.changed, lookups: npm.createdLookups }).toEqual({ changed: ['nexus.ndjson', 'manifest.json'], lookups: 1 })
  })

  it('leaves the dataset untouched when npm fails part way through', async () => {
    await refreshDownloads({ dir, packages: [FEATURES], client: fixtureNpm('2026-09-10'), now: NOW })
    const before = readdirSync(dir).map((file) => [file, readFileSync(join(dir, file), 'utf8')])
    const failing = fixtureNpm('2026-09-12', 0, new NpmStatsError('truncated-range', 'moved start'))
    await expect(refreshDownloads({ dir, packages: [FEATURES, NEXUS], client: failing, now: NOW + 2 * 86_400_000 })).rejects.toThrow(
      'moved start'
    )
    expect(readdirSync(dir).map((file) => [file, readFileSync(join(dir, file), 'utf8')])).toEqual(before)
  })

  it('refuses to run with no packages', async () => {
    await expect(refreshDownloads({ dir, packages: [], client: fixtureNpm('2026-09-10'), now: NOW })).rejects.toThrow(
      'No packages to refresh'
    )
  })
})
