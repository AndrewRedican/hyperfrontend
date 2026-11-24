import type { DownloadDay, DownloadsSnapshot, PackageDownloads } from '../downloads'
import type { LiveDownloads, LivePackage } from './live'
import { describe, expect, it } from 'vitest'
import { addsUpTo, liveSince, overlaySnapshot, readLiveSnapshot, validateLiveAnswer } from './live'
import { NpmStatsError } from './model'

const FEATURES = '@hyperfrontend/features'
const NEXUS = '@hyperfrontend/nexus'

/**
 * A run of consecutive days.
 *
 * @param first - The first day, as a day of November 2026
 * @param counts - One count per day
 * @returns The days
 */
function run(first: number, counts: number[]): DownloadDay[] {
  return counts.map((downloads, index) => ({ day: `2026-11-${String(first + index).padStart(2, '0')}`, downloads }))
}

/**
 * A package as a page is built with it.
 *
 * @param packageName - Full npm package name
 * @param days - Its days, at least one
 * @returns The package, summed
 */
function built(packageName: string, days: DownloadDay[]): PackageDownloads {
  return {
    package: packageName,
    total: days.reduce((sum, entry) => sum + entry.downloads, 0),
    firstDay: days[0].day,
    lastDay: days[days.length - 1].day,
    days,
  }
}

/**
 * A well-formed answer, with any field replaced.
 *
 * @param overrides - Fields to replace, valid or not
 * @returns The answer body as the service would send it
 */
function answer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    frontier: '2026-11-23',
    collectedAt: '2026-11-24T14:00:03.120Z',
    revalidationDays: 7,
    packages: [{ package: FEATURES, created: '2026-06-28', total: 28, days: run(17, [1, 2, 3, 4, 5, 6, 7]) }],
    ...overrides,
  }
}

const ENTRY = { package: FEATURES, created: '2026-06-28', total: 3, days: run(17, [1, 2]) }

/**
 * An answer holding one package entry, valid or not.
 *
 * @param entry - Fields to replace in the package entry
 * @returns The answer body
 */
function answerWith(entry: Record<string, unknown>): Record<string, unknown> {
  return answer({ packages: [{ ...ENTRY, ...entry }] })
}

/**
 * A validated answer for the overlay to read.
 *
 * @param packages - The packages it holds, each totalled from its days
 * @param frontier - Its frontier
 * @returns The answer
 */
function live(packages: Array<Omit<LivePackage, 'total'>>, frontier = '2026-11-23'): LiveDownloads {
  return {
    version: 1,
    frontier,
    collectedAt: '2026-11-24T14:00:03.120Z',
    revalidationDays: 7,
    packages: packages.map((entry) => ({ ...entry, total: entry.days.reduce((sum, day) => sum + day.downloads, 0) })),
  }
}

const SNAPSHOT: DownloadsSnapshot = {
  frontier: '2026-11-21',
  refreshedAt: '2026-11-22T19:18:21.680Z',
  packages: [built(FEATURES, run(18, [10, 10, 10, 10])), built(NEXUS, run(18, [9, 9, 9, 9]))],
  total: 76,
}

describe('validateLiveAnswer', () => {
  it('returns a well-formed answer field for field', () => {
    expect(validateLiveAnswer(answer(), '2026-11-17')).toEqual(answer())
  })

  it('accepts days of any age when the whole history was asked for', () => {
    expect(validateLiveAnswer(answer(), null).packages[0].days).toEqual(run(17, [1, 2, 3, 4, 5, 6, 7]))
  })

  it('accepts a package with no days', () => {
    expect(validateLiveAnswer(answerWith({ days: [] }), '2026-11-17').packages).toEqual([
      { package: FEATURES, created: '2026-06-28', total: 3, days: [] },
    ])
  })

  it('accepts a total larger than the answered days when only recent days were asked for', () => {
    expect(validateLiveAnswer(answerWith({ total: 100 }), '2026-11-17').packages[0].total).toBe(100)
  })

  it('rejects a whole history whose total is not the sum of its days', () => {
    expect(() => validateLiveAnswer(answerWith({ total: 100 }), null)).toThrow(`states a total of 100 for ${FEATURES}`)
  })

  it('classifies a rejected answer as schema drift', () => {
    expect(() => validateLiveAnswer(null, null)).toThrow(expect.objectContaining({ name: 'NpmStatsError', kind: 'schema-drift' }))
  })

  it('throws the classified error type', () => {
    expect(() => validateLiveAnswer([], null)).toThrow(NpmStatsError)
  })

  it.each([
    ['a body that is not an object', 'not json', 'is not an object'],
    ['an array for a body', [answer()], 'is not an object'],
    ['another version', answer({ version: 2 }), 'is version 2, this site reads 1'],
    ['a frontier that is not a string', answer({ frontier: 20261123 }), 'malformed frontier: 20261123'],
    ['a frontier that is no real day', answer({ frontier: '2026-02-30' }), 'malformed frontier: 2026-02-30'],
    ['a collection time that is not a string', answer({ collectedAt: 1 }), 'malformed collection time: 1'],
    ['a collection time that is no date', answer({ collectedAt: 'yesterday' }), 'malformed collection time: yesterday'],
    ['a revalidation window that is not a number', answer({ revalidationDays: '7' }), 'malformed revalidation window: 7'],
    ['a fractional revalidation window', answer({ revalidationDays: 1.5 }), 'malformed revalidation window: 1.5'],
    ['a revalidation window of zero', answer({ revalidationDays: 0 }), 'malformed revalidation window: 0'],
    ['packages that are not a list', answer({ packages: {} }), 'carries no list of packages'],
    ['a package that is not an object', answer({ packages: [FEATURES] }), 'carries a package that is not an object'],
    ['a package without a name', answerWith({ package: 7 }), 'carries a package with no name: 7'],
    ['a package named twice', answer({ packages: [ENTRY, ENTRY] }), `carries ${FEATURES} twice`],
    ['a created day that is not a string', answerWith({ created: null }), `malformed created day for ${FEATURES}: null`],
    ['a created day that is no real day', answerWith({ created: '2026-13-01' }), `malformed created day for ${FEATURES}: 2026-13-01`],
    ['days that are not a list', answerWith({ days: 'none' }), `carries no list of days for ${FEATURES}`],
    ['a day that is not an object', answerWith({ days: ['2026-11-17'] }), `carries a day of ${FEATURES} that is not an object`],
    ['a day that is no real day', answerWith({ days: [{ day: '2026-11-31', downloads: 1 }] }), `malformed day for ${FEATURES}: 2026-11-31`],
    ['a day that is not a string', answerWith({ days: [{ day: 17, downloads: 1 }] }), `malformed day for ${FEATURES}: 17`],
    [
      'a count that is not a number',
      answerWith({ days: [{ day: '2026-11-17', downloads: '1' }] }),
      `malformed count for ${FEATURES} on 2026-11-17: 1`,
    ],
    [
      'a fractional count',
      answerWith({ days: [{ day: '2026-11-17', downloads: 0.5 }] }),
      `malformed count for ${FEATURES} on 2026-11-17: 0.5`,
    ],
    ['a negative count', answerWith({ days: [{ day: '2026-11-17', downloads: -1 }] }), `malformed count for ${FEATURES} on 2026-11-17: -1`],
    ['a skipped day', answerWith({ days: [...run(17, [1]), ...run(19, [3])] }), 'jumps from 2026-11-17 to 2026-11-19'],
    ['a repeated day', answerWith({ days: [...run(17, [1]), ...run(17, [1])] }), 'jumps from 2026-11-17 to 2026-11-17'],
    ['a day before the one asked for', answerWith({ days: run(16, [1, 2]) }), 'carries 2026-11-16'],
    ['a total that is not a number', answerWith({ total: '3' }), `malformed total for ${FEATURES}: 3`],
    ['a negative total', answerWith({ total: -1 }), `malformed total for ${FEATURES}: -1`],
    ['a total smaller than the days it comes with', answerWith({ total: 2 }), `states a total of 2 for ${FEATURES}`],
    ['a day after the frontier', answerWith({ days: run(23, [1, 2]) }), 'carries 2026-11-24'],
  ])('rejects %s', (_title, body, problem) => {
    expect(() => validateLiveAnswer(body, '2026-11-17')).toThrow(problem)
  })
})

describe('liveSince', () => {
  it('reaches back over the days npm may still revise', () => {
    expect(liveSince('2026-11-23')).toBe('2026-11-17')
  })

  it('honours a window other than the default', () => {
    expect(liveSince('2026-11-02', 3)).toBe('2026-10-31')
  })

  it('asks for the frontier alone when the window is one day', () => {
    expect(liveSince('2026-11-23', 1)).toBe('2026-11-23')
  })
})

describe('overlaySnapshot', () => {
  it('returns the built snapshot itself when the answer is older', () => {
    expect(overlaySnapshot(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(18, [99, 99, 99]) }], '2026-11-20'))).toBe(
      SNAPSHOT
    )
  })

  it('replaces revised days and appends the new ones', () => {
    const overlaid = overlaySnapshot(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(20, [11, 12, 13, 14]) }]))
    expect(overlaid.packages.find((entry) => entry.package === FEATURES)).toEqual(built(FEATURES, run(18, [10, 10, 11, 12, 13, 14])))
  })

  it('takes every day from an answer that reaches back past the first built day', () => {
    const overlaid = overlaySnapshot(
      SNAPSHOT,
      live([{ package: FEATURES, created: '2026-06-28', days: run(16, [1, 1, 1, 1, 1, 1, 1, 1]) }])
    )
    expect(overlaid.packages.find((entry) => entry.package === FEATURES)).toEqual(built(FEATURES, run(16, [1, 1, 1, 1, 1, 1, 1, 1])))
  })

  it('joins answered days that start the day after the last built one', () => {
    const overlaid = overlaySnapshot(SNAPSHOT, live([{ package: NEXUS, created: '2026-02-15', days: run(22, [5, 5]) }]))
    expect(overlaid.packages.find((entry) => entry.package === NEXUS)).toEqual(built(NEXUS, run(18, [9, 9, 9, 9, 5, 5])))
  })

  it('keeps a package the answer does not hold as built', () => {
    const overlaid = overlaySnapshot(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(20, [11, 12, 13, 14]) }]))
    expect(overlaid.packages.find((entry) => entry.package === NEXUS)).toBe(SNAPSHOT.packages[1])
  })

  it('keeps a package whose answered days are empty as built', () => {
    expect(overlaySnapshot(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: [] }])).packages[0]).toBe(SNAPSHOT.packages[0])
  })

  it('keeps a package whose answered days would leave a hole as built', () => {
    const overlaid = overlaySnapshot(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(23, [50]) }]))
    expect(overlaid.packages[0]).toBe(SNAPSHOT.packages[0])
  })

  it('ignores a package only the service knows', () => {
    const overlaid = overlaySnapshot(
      SNAPSHOT,
      live([{ package: '@hyperfrontend/unbuilt', created: '2026-11-01', days: run(20, [1, 1, 1, 1]) }])
    )
    expect(overlaid.packages.map((entry) => entry.package)).toEqual([FEATURES, NEXUS])
  })

  it('is counted through the frontier and collection time of the answer', () => {
    expect(overlaySnapshot(SNAPSHOT, live([]))).toMatchObject({ frontier: '2026-11-23', refreshedAt: '2026-11-24T14:00:03.120Z' })
  })

  it('takes a same-day answer, which may carry revised counts', () => {
    const overlaid = overlaySnapshot(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(20, [20, 20]) }], '2026-11-21'))
    expect(overlaid.total).toBe(96)
  })

  it('sums the ecosystem total from the overlaid packages', () => {
    expect(overlaySnapshot(SNAPSHOT, live([{ package: NEXUS, created: '2026-02-15', days: run(22, [5, 5]) }])).total).toBe(86)
  })

  it('ranks the packages again by their new totals', () => {
    const overlaid = overlaySnapshot(SNAPSHOT, live([{ package: NEXUS, created: '2026-02-15', days: run(22, [5, 5]) }]))
    expect(overlaid.packages.map((entry) => entry.package)).toEqual([NEXUS, FEATURES])
  })

  it('leaves the built snapshot as it was', () => {
    const before = structuredClone(SNAPSHOT)
    overlaySnapshot(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(20, [11, 12, 13, 14]) }]))
    expect(SNAPSHOT).toEqual(before)
  })
})

describe('addsUpTo', () => {
  it('holds when every package the service knows has the service total', () => {
    expect(addsUpTo(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(18, [10, 10, 10, 10]) }], '2026-11-21'))).toBe(
      true
    )
  })

  it('fails when a package adds up to something else', () => {
    expect(addsUpTo(SNAPSHOT, live([{ package: FEATURES, created: '2026-06-28', days: run(17, [7, 10, 10, 10, 10]) }], '2026-11-21'))).toBe(
      false
    )
  })

  it('passes over a package the service does not hold', () => {
    expect(addsUpTo(SNAPSHOT, live([], '2026-11-21'))).toBe(true)
  })
})

describe('readLiveSnapshot', () => {
  /** The features package counted two days past the build, with nothing older changed. */
  const RECENT = { package: FEATURES, created: '2026-06-28', total: 50, days: run(18, [10, 10, 10, 10, 5, 5]) }

  /** The same package once npm has filled in the day before the first built one. */
  const WHOLE = { package: FEATURES, created: '2026-06-28', total: 57, days: run(17, [7, 10, 10, 10, 10, 5, 5]) }

  /**
   * A service that answers from a table and records what it was asked.
   *
   * @param recent - What it answers a request for recent days with
   * @param whole - What it answers a request for the whole history with, or an error to reject with
   * @returns The asking function and the days it was asked from
   */
  function service(
    recent: unknown,
    whole: unknown = answer({ packages: [WHOLE] })
  ): { ask: (since: string | null) => Promise<unknown>; asked: Array<string | null> } {
    const asked: Array<string | null> = []
    return {
      asked,
      ask: async (since) => {
        asked.push(since)
        const body = since === null ? whole : recent
        if (body instanceof Error) throw body
        return body
      },
    }
  }

  it('asks for the recent days alone while every package adds up', async () => {
    const { ask, asked } = service(answer({ packages: [RECENT] }))
    await readLiveSnapshot(SNAPSHOT, ask)
    expect(asked).toEqual(['2026-11-15'])
  })

  it('shows the days counted since the build', async () => {
    const { ask } = service(answer({ packages: [RECENT] }))
    expect((await readLiveSnapshot(SNAPSHOT, ask)).packages.find((entry) => entry.package === FEATURES)).toMatchObject({
      total: 50,
      lastDay: '2026-11-23',
    })
  })

  it('asks for the whole history when an older day no longer adds up', async () => {
    const { ask, asked } = service(answer({ packages: [{ ...RECENT, total: 57 }] }))
    await readLiveSnapshot(SNAPSHOT, ask)
    expect(asked).toEqual(['2026-11-15', null])
  })

  it('shows the count npm filled in for a day older than the build re-reads', async () => {
    const { ask } = service(answer({ packages: [{ ...RECENT, total: 57 }] }))
    expect((await readLiveSnapshot(SNAPSHOT, ask)).packages.find((entry) => entry.package === FEATURES)).toMatchObject({
      total: 57,
      firstDay: '2026-11-17',
    })
  })

  it('keeps the recent days when the whole history cannot be had', async () => {
    const { ask } = service(answer({ packages: [{ ...RECENT, total: 57 }] }), new Error('unreachable'))
    expect((await readLiveSnapshot(SNAPSHOT, ask)).packages.find((entry) => entry.package === FEATURES)?.total).toBe(50)
  })

  it('returns the built snapshot itself, after one request, when the service is behind the build', async () => {
    const { ask, asked } = service(answer({ frontier: '2026-11-20', packages: [] }))
    expect({ snapshot: await readLiveSnapshot(SNAPSHOT, ask), asked }).toEqual({ snapshot: SNAPSHOT, asked: ['2026-11-15'] })
  })

  it('rejects when the service gives no usable first answer', async () => {
    const { ask } = service(new Error('unreachable'))
    await expect(readLiveSnapshot(SNAPSHOT, ask)).rejects.toThrow('unreachable')
  })
})
