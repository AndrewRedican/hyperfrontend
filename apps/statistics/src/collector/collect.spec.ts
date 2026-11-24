import type { NpmClient } from './client'
import type { History } from './collect'
import type { Day } from './dates'
import type { DailyDownloads } from './model'
import type { RangeRequest } from './validate'
import { dateParse } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { parseInt as parseInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { describe, expect, it } from '@hyperfrontend/testing'
import { collect } from './collect'
import { daysBetween, daysInclusive } from './dates'
import { NpmStatsError } from './model'

const FEATURES = '@hyperfrontend/features'
const NEXUS = '@hyperfrontend/nexus'
const UNRELEASED = '@hyperfrontend/unreleased'

/** Noon UTC on the day after the frontier most fixtures answer with. */
const NOW = dateParse('2026-09-12T12:00:00.000Z')

/** What the fixture registry knows about each package; a package absent from it is one npm does not know. */
const CREATED: Record<string, Day> = { [FEATURES]: '2026-06-28', [NEXUS]: '2026-02-15' }

/** How a fixture npm is told to behave. */
interface FixtureOptions {
  /** The newest day it has counted */
  frontier: Day
  /** Added to every count it reports, to simulate a revision */
  offset?: number
  /** Packages it knows; every package of {@link CREATED} when omitted */
  known?: readonly string[]
  /** A failure the first range request rejects with */
  failRangeWith?: NpmStatsError
  /** A failure the frontier probe rejects with */
  failProbeWith?: NpmStatsError
}

/** A fixture npm: deterministic counts, a fixed frontier, and a log of every request. */
interface FixtureNpm extends NpmClient {
  /** Every range request made, in order */
  ranges: RangeRequest[]
  /** The packages whose creation day was looked up, in order */
  createdLookups: string[]
  /** The packages the frontier was asked through, in order */
  probes: string[]
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
  return parseInteger(day.slice(8, 10), 10) + offset
}

/**
 * The failure npm answers a package it does not know with.
 *
 * @param packageName - The package asked about
 * @returns The classified failure
 */
function unknownPackage(packageName: string): NpmStatsError {
  return new NpmStatsError('package-not-found', `npm knows no package ${packageName}`)
}

/**
 * A fixture npm.
 *
 * @param options - See {@link FixtureOptions}
 * @returns The client
 */
function fixtureNpm(options: FixtureOptions): FixtureNpm {
  const known = options.known ?? [FEATURES, NEXUS]
  const ranges: RangeRequest[] = []
  const createdLookups: string[] = []
  const probes: string[] = []
  let requestCount = 0
  return {
    ranges,
    createdLookups,
    probes,
    get requestCount() {
      return requestCount
    },
    fetchLastDay: async (packageName) => {
      requestCount += 1
      probes.push(packageName)
      if (options.failProbeWith !== undefined) throw options.failProbeWith
      if (!known.includes(packageName)) throw unknownPackage(packageName)
      return options.frontier
    },
    fetchCreated: async (packageName) => {
      requestCount += 1
      createdLookups.push(packageName)
      if (!known.includes(packageName)) throw unknownPackage(packageName)
      return CREATED[packageName]
    },
    fetchRange: async (request) => {
      requestCount += 1
      ranges.push(request)
      if (options.failRangeWith !== undefined && ranges.length === 1) throw options.failRangeWith
      if (!known.includes(request.package)) throw unknownPackage(request.package)
      return daysBetween(request.start, request.end).map(
        (day): DailyDownloads => ({ package: request.package, day, downloads: countFor(day, options.offset ?? 0) })
      )
    },
  }
}

/**
 * Collect once from nothing.
 *
 * @param packages - The packages to track
 * @param frontier - The newest day the fixture npm has counted
 * @param known - The packages the fixture npm knows; every fixture package when omitted
 * @returns The history a first collection holds
 */
async function firstCollection(packages: readonly string[], frontier: Day, known?: readonly string[]): Promise<History> {
  return (await collect({ packages, client: fixtureNpm({ frontier, known }), now: NOW, held: null })).history
}

/**
 * The failure kind a collection rejects with, or null when it resolves.
 *
 * @param run - The collection under test
 * @returns The failure's category, or null
 */
async function kindOf(run: Promise<unknown>): Promise<string | null> {
  try {
    await run
    return null
  } catch (error) {
    return error instanceof NpmStatsError ? error.kind : 'unexpected'
  }
}

describe('collect', () => {
  it('collects a new package from its first published day to the frontier', async () => {
    const npm = fixtureNpm({ frontier: '2026-09-11' })
    await collect({ packages: [FEATURES], client: npm, now: NOW, held: null })
    expect(npm.ranges).toEqual([{ package: FEATURES, start: '2026-06-28', end: '2026-09-11' }])
  })

  it('holds the frontier, the time of the collection and every package it learned', async () => {
    const collection = await collect({ packages: [FEATURES], client: fixtureNpm({ frontier: '2026-06-29' }), now: NOW, held: null })
    expect({ ...collection, history: { ...collection.history, packages: [...collection.history.packages] } }).toEqual({
      outcome: 'collected',
      pending: [],
      history: {
        frontier: '2026-06-29',
        collectedAt: '2026-09-12T12:00:00.000Z',
        packages: [
          [
            FEATURES,
            {
              created: '2026-06-28',
              days: [
                { package: FEATURES, day: '2026-06-28', downloads: 28 },
                { package: FEATURES, day: '2026-06-29', downloads: 29 },
              ],
            },
          ],
        ],
      },
    })
  })

  it('never asks one request for more days than the chunk cap once a history exceeds it', async () => {
    const npm = fixtureNpm({ frontier: '2027-12-31' })
    await collect({ packages: [NEXUS], client: npm, now: NOW, held: null })
    expect(npm.ranges.map((range) => daysInclusive(range.start, range.end))).toEqual([500, 185])
  })

  it('leaves the held history alone while npm has counted no new day', async () => {
    const held = await firstCollection([FEATURES, NEXUS], '2026-09-11')
    const collection = await collect({ packages: [FEATURES, NEXUS], client: fixtureNpm({ frontier: '2026-09-11' }), now: NOW, held })
    expect({ outcome: collection.outcome, same: collection.history === held }).toEqual({ outcome: 'unchanged', same: true })
  })

  it('spends one request finding that npm has counted no new day', async () => {
    const held = await firstCollection([FEATURES, NEXUS], '2026-09-11')
    const npm = fixtureNpm({ frontier: '2026-09-11' })
    await collect({ packages: [FEATURES, NEXUS], client: npm, now: NOW, held })
    expect(npm.requestCount).toBe(1)
  })

  it('reads a history again, whole, once npm has counted a new day', async () => {
    const held = await firstCollection([FEATURES], '2026-09-11')
    const npm = fixtureNpm({ frontier: '2026-09-13' })
    await collect({ packages: [FEATURES], client: npm, now: NOW, held })
    expect(npm.ranges).toEqual([{ package: FEATURES, start: '2026-06-28', end: '2026-09-13' }])
  })

  it('does not look up a creation day it already knows', async () => {
    const held = await firstCollection([FEATURES], '2026-09-11')
    const npm = fixtureNpm({ frontier: '2026-09-12' })
    await collect({ packages: [FEATURES], client: npm, now: NOW, held })
    expect(npm.createdLookups).toEqual([])
  })

  it('takes a count npm filled in long after the day it belongs to', async () => {
    const held = await firstCollection([FEATURES], '2026-09-11')
    const collection = await collect({ packages: [FEATURES], client: fixtureNpm({ frontier: '2026-09-12', offset: 100 }), now: NOW, held })
    expect(collection.history.packages.get(FEATURES)?.days[0]).toEqual({ package: FEATURES, day: '2026-06-28', downloads: 128 })
  })

  it('reports a tracked package npm does not know as pending and collects the others', async () => {
    const collection = await collect({
      packages: [UNRELEASED, FEATURES],
      client: fixtureNpm({ frontier: '2026-09-11' }),
      now: NOW,
      held: null,
    })
    expect({ pending: collection.pending, packages: [...collection.history.packages.keys()] }).toEqual({
      pending: [UNRELEASED],
      packages: [FEATURES],
    })
  })

  it('asks the frontier through the first package npm knows', async () => {
    const npm = fixtureNpm({ frontier: '2026-09-11' })
    await collect({ packages: [UNRELEASED, FEATURES], client: npm, now: NOW, held: null })
    expect(npm.probes).toEqual([UNRELEASED, FEATURES])
  })

  it('keeps asking about a pending package without touching the others while the frontier stands', async () => {
    const held = await firstCollection([UNRELEASED, FEATURES], '2026-09-11')
    const npm = fixtureNpm({ frontier: '2026-09-11' })
    const collection = await collect({ packages: [UNRELEASED, FEATURES], client: npm, now: NOW, held })
    expect({ outcome: collection.outcome, pending: collection.pending, lookups: npm.createdLookups, ranges: npm.ranges }).toEqual({
      outcome: 'unchanged',
      pending: [UNRELEASED],
      lookups: [UNRELEASED],
      ranges: [],
    })
  })

  it('collects a pending package once npm knows it, in the order the packages are tracked', async () => {
    const held = await firstCollection([NEXUS, FEATURES], '2026-09-11', [FEATURES])
    const collection = await collect({ packages: [NEXUS, FEATURES], client: fixtureNpm({ frontier: '2026-09-11' }), now: NOW, held })
    expect({ outcome: collection.outcome, packages: [...collection.history.packages.keys()] }).toEqual({
      outcome: 'collected',
      packages: [NEXUS, FEATURES],
    })
  })

  it('keeps the days of a held package npm stops answering for', async () => {
    const held = await firstCollection([FEATURES], '2026-09-11')
    const collection = await collect({
      packages: [FEATURES, NEXUS],
      client: fixtureNpm({ frontier: '2026-09-12', known: [NEXUS] }),
      now: NOW,
      held,
    })
    expect({ pending: collection.pending, kept: collection.history.packages.get(FEATURES) === held.packages.get(FEATURES) }).toEqual({
      pending: [FEATURES],
      kept: true,
    })
  })

  it('refuses to collect when npm knows none of the tracked packages', async () => {
    await expect(
      kindOf(collect({ packages: [UNRELEASED], client: fixtureNpm({ frontier: '2026-09-11' }), now: NOW, held: null }))
    ).resolves.toBe('package-not-found')
  })

  it('fails when the frontier cannot be learned', async () => {
    const failProbeWith = new NpmStatsError('unavailable', 'npm is down')
    await expect(
      kindOf(collect({ packages: [FEATURES], client: fixtureNpm({ frontier: '2026-09-11', failProbeWith }), now: NOW, held: null }))
    ).resolves.toBe('unavailable')
  })

  it('fails whole when npm breaks an expectation part way through', async () => {
    const failRangeWith = new NpmStatsError('truncated-range', 'npm moved the start')
    await expect(
      kindOf(collect({ packages: [FEATURES, NEXUS], client: fixtureNpm({ frontier: '2026-09-11', failRangeWith }), now: NOW, held: null }))
    ).resolves.toBe('truncated-range')
  })
})
