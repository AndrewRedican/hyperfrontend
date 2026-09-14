import { describe, expect, it } from 'vitest'
import { NpmStatsError } from './model'
import { validateCreatedResponse, validateLastDayResponse, validateRangeResponse } from './validate'

const PACKAGE = '@hyperfrontend/features'
const REQUEST = { package: PACKAGE, start: '2026-09-01', end: '2026-09-03' }

/**
 * A well-formed range body for the request above, to be broken one field at a time.
 *
 * @returns A body that passes validation as it stands
 */
function goodBody(): Record<string, unknown> {
  return {
    start: '2026-09-01',
    end: '2026-09-03',
    package: PACKAGE,
    downloads: [
      { downloads: 6, day: '2026-09-01' },
      { downloads: 0, day: '2026-09-02' },
      { downloads: 7, day: '2026-09-03' },
    ],
  }
}

/**
 * The failure kind a validation throws, or null when it passes.
 *
 * @param run - The validation to attempt
 * @returns The failure's category, or null
 */
function kindOf(run: () => unknown): string | null {
  try {
    run()
    return null
  } catch (error) {
    return error instanceof NpmStatsError ? error.kind : 'unexpected'
  }
}

describe('validateRangeResponse', () => {
  it('turns a well-formed body into daily records', () => {
    expect(validateRangeResponse(goodBody(), REQUEST)).toEqual([
      { package: PACKAGE, day: '2026-09-01', downloads: 6 },
      { package: PACKAGE, day: '2026-09-02', downloads: 0 },
      { package: PACKAGE, day: '2026-09-03', downloads: 7 },
    ])
  })

  it('rejects a body that is not an object as schema drift', () => {
    expect(kindOf(() => validateRangeResponse([], REQUEST))).toBe('schema-drift')
  })

  it('rejects a body naming another package as schema drift', () => {
    expect(kindOf(() => validateRangeResponse({ ...goodBody(), package: '@hyperfrontend/nexus' }, REQUEST))).toBe('schema-drift')
  })

  it('reports a moved start as a truncated range', () => {
    expect(kindOf(() => validateRangeResponse({ ...goodBody(), start: '2026-09-02' }, REQUEST))).toBe('truncated-range')
  })

  it('reports a moved end as a truncated range', () => {
    expect(kindOf(() => validateRangeResponse({ ...goodBody(), end: '2026-09-02' }, REQUEST))).toBe('truncated-range')
  })

  it('names both spans in the truncation message so the failure is actionable', () => {
    expect(() => validateRangeResponse({ ...goodBody(), start: '2026-09-02' }, REQUEST)).toThrow(
      '2026-09-01:2026-09-03 with 2026-09-02:2026-09-03'
    )
  })

  it('rejects a missing downloads array as schema drift', () => {
    expect(kindOf(() => validateRangeResponse({ ...goodBody(), downloads: undefined }, REQUEST))).toBe('schema-drift')
  })

  it('reports fewer days than the span as an incomplete range', () => {
    const body = goodBody()
    body['downloads'] = (body['downloads'] as unknown[]).slice(0, 2)
    expect(kindOf(() => validateRangeResponse(body, REQUEST))).toBe('incomplete-range')
  })

  it('reports a repeated day as an incomplete range', () => {
    const body = goodBody()
    body['downloads'] = [
      { downloads: 6, day: '2026-09-01' },
      { downloads: 0, day: '2026-09-01' },
      { downloads: 7, day: '2026-09-03' },
    ]
    expect(kindOf(() => validateRangeResponse(body, REQUEST))).toBe('incomplete-range')
  })

  it('reports a day outside the span as an incomplete range', () => {
    const body = goodBody()
    body['downloads'] = [
      { downloads: 6, day: '2026-08-31' },
      { downloads: 0, day: '2026-09-02' },
      { downloads: 7, day: '2026-09-03' },
    ]
    expect(kindOf(() => validateRangeResponse(body, REQUEST))).toBe('incomplete-range')
  })

  it('reports days out of order as an incomplete range', () => {
    const body = goodBody()
    body['downloads'] = [
      { downloads: 6, day: '2026-09-02' },
      { downloads: 0, day: '2026-09-01' },
      { downloads: 7, day: '2026-09-03' },
    ]
    expect(kindOf(() => validateRangeResponse(body, REQUEST))).toBe('incomplete-range')
  })

  it('rejects a count that is not a non-negative integer as schema drift', () => {
    const body = goodBody()
    body['downloads'] = [
      { downloads: '6', day: '2026-09-01' },
      { downloads: 0, day: '2026-09-02' },
      { downloads: 7, day: '2026-09-03' },
    ]
    expect(kindOf(() => validateRangeResponse(body, REQUEST))).toBe('schema-drift')
  })

  it('rejects a negative count as schema drift', () => {
    const body = goodBody()
    body['downloads'] = [
      { downloads: -1, day: '2026-09-01' },
      { downloads: 0, day: '2026-09-02' },
      { downloads: 7, day: '2026-09-03' },
    ]
    expect(kindOf(() => validateRangeResponse(body, REQUEST))).toBe('schema-drift')
  })

  it('rejects a malformed day as schema drift', () => {
    const body = goodBody()
    body['downloads'] = [
      { downloads: 6, day: '2026-09-01' },
      { downloads: 0, day: '09/02/2026' },
      { downloads: 7, day: '2026-09-03' },
    ]
    expect(kindOf(() => validateRangeResponse(body, REQUEST))).toBe('schema-drift')
  })
})

describe('validateLastDayResponse', () => {
  it('reads the newest counted day', () => {
    expect(validateLastDayResponse({ downloads: 11, start: '2026-09-10', end: '2026-09-10', package: PACKAGE }, PACKAGE)).toBe('2026-09-10')
  })

  it('rejects a body for another package', () => {
    expect(
      kindOf(() => validateLastDayResponse({ downloads: 11, start: '2026-09-10', end: '2026-09-10', package: 'other' }, PACKAGE))
    ).toBe('schema-drift')
  })

  it('rejects a body without an end day', () => {
    expect(kindOf(() => validateLastDayResponse({ downloads: 11, package: PACKAGE }, PACKAGE))).toBe('schema-drift')
  })
})

describe('validateCreatedResponse', () => {
  it('reads the creation day off the registry document', () => {
    expect(validateCreatedResponse({ name: PACKAGE, time: { created: '2026-06-28T13:22:06.094Z' } }, PACKAGE)).toBe('2026-06-28')
  })

  it('rejects a document without a time map', () => {
    expect(kindOf(() => validateCreatedResponse({ name: PACKAGE }, PACKAGE))).toBe('schema-drift')
  })

  it('rejects an unreadable creation time', () => {
    expect(kindOf(() => validateCreatedResponse({ name: PACKAGE, time: { created: 'yesterday' } }, PACKAGE))).toBe('schema-drift')
  })
})
