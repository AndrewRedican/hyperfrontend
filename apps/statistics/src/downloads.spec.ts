import type { ServiceResponse } from '@hyperfrontend/server'
import type { History } from './collector/collect'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isHttpError } from '@hyperfrontend/server'
import { describe, expect, it } from '@hyperfrontend/testing'
import { answerDownloads } from './downloads'

const FEATURES = '@hyperfrontend/features'
const NEXUS = '@hyperfrontend/nexus'

/** A held history of two packages, three days and one day long. */
const HELD: History = {
  frontier: '2026-09-03',
  collectedAt: '2026-09-04T12:00:00.000Z',
  packages: createMap([
    [
      FEATURES,
      {
        created: '2026-09-01',
        days: [
          { package: FEATURES, day: '2026-09-01', downloads: 1 },
          { package: FEATURES, day: '2026-09-02', downloads: 2 },
          { package: FEATURES, day: '2026-09-03', downloads: 3 },
        ],
      },
    ],
    [NEXUS, { created: '2026-09-03', days: [{ package: NEXUS, day: '2026-09-03', downloads: 7 }] }],
  ]),
}

/**
 * The JSON a response carries.
 *
 * @param response - What the route answered
 * @returns Its body, parsed
 */
function bodyOf(response: ServiceResponse): unknown {
  return parse(String(response.body))
}

describe('answerDownloads', () => {
  it('answers the whole history when no day is asked for', () => {
    expect(bodyOf(answerDownloads(HELD, null))).toEqual({
      version: 1,
      frontier: '2026-09-03',
      collectedAt: '2026-09-04T12:00:00.000Z',
      revalidationDays: 7,
      packages: [
        {
          package: FEATURES,
          created: '2026-09-01',
          total: 6,
          days: [
            { day: '2026-09-01', downloads: 1 },
            { day: '2026-09-02', downloads: 2 },
            { day: '2026-09-03', downloads: 3 },
          ],
        },
        { package: NEXUS, created: '2026-09-03', total: 7, days: [{ day: '2026-09-03', downloads: 7 }] },
      ],
    })
  })

  it('answers the day asked for and every later one', () => {
    expect(bodyOf(answerDownloads(HELD, '2026-09-02'))).toEqual(
      expect.objectContaining({
        packages: [
          expect.objectContaining({
            days: [
              { day: '2026-09-02', downloads: 2 },
              { day: '2026-09-03', downloads: 3 },
            ],
          }),
          expect.objectContaining({ days: [{ day: '2026-09-03', downloads: 7 }] }),
        ],
      })
    )
  })

  it('totals every day a package has, whatever day was asked for', () => {
    expect(bodyOf(answerDownloads(HELD, '2026-09-03'))).toEqual(
      expect.objectContaining({ packages: [expect.objectContaining({ total: 6 }), expect.objectContaining({ total: 7 })] })
    )
  })

  it('keeps a package whose days all precede the day asked for, with no days', () => {
    expect(bodyOf(answerDownloads(HELD, '2026-09-04'))).toEqual(
      expect.objectContaining({ packages: [expect.objectContaining({ days: [] }), expect.objectContaining({ days: [] })] })
    )
  })

  it('lets a client or a cache reuse an answer for a few minutes', () => {
    expect(answerDownloads(HELD, null)).toEqual(
      expect.objectContaining({ status: 200, headers: expect.objectContaining({ 'Cache-Control': 'public, max-age=300' }) })
    )
  })

  it('answers 503 with a time to ask again before the first collection', () => {
    expect(answerDownloads(null, null)).toEqual(
      expect.objectContaining({ status: 503, headers: expect.objectContaining({ 'Cache-Control': 'no-store', 'Retry-After': '30' }) })
    )
  })

  it('says it is collecting before the first collection', () => {
    expect(bodyOf(answerDownloads(null, null))).toEqual({ error: 'collecting' })
  })

  it('refuses a since that is no calendar day with 400', () => {
    let thrown: unknown
    try {
      answerDownloads(HELD, '2026-02-30')
    } catch (error) {
      thrown = error
    }
    expect(isHttpError(thrown) && thrown.status).toBe(400)
  })

  it('refuses a malformed since even before the first collection', () => {
    expect(() => answerDownloads(null, 'yesterday')).toThrow('since-not-a-day')
  })
})
