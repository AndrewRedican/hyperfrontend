import { describe, expect, it } from 'vitest'
import { NpmStatsError } from './model'
import { parseNdjson, serializeNdjson } from './ndjson'

const RECORDS = [
  { package: '@hyperfrontend/features', day: '2026-06-28', downloads: 60 },
  { package: '@hyperfrontend/features', day: '2026-06-29', downloads: 5 },
]

/**
 * The failure kind a parse throws, or null when it passes.
 *
 * @param text - The file contents under test
 * @returns The failure's category, or null
 */
function kindOf(text: string): string | null {
  try {
    parseNdjson(text, 'features.ndjson')
    return null
  } catch (error) {
    return error instanceof NpmStatsError ? error.kind : 'unexpected'
  }
}

describe('serializeNdjson', () => {
  it('writes one record per line with a trailing newline and no array', () => {
    expect(serializeNdjson(RECORDS)).toBe(
      '{"package":"@hyperfrontend/features","day":"2026-06-28","downloads":60}\n{"package":"@hyperfrontend/features","day":"2026-06-29","downloads":5}\n'
    )
  })

  it('writes keys in a fixed order whatever order the record was built in', () => {
    expect(serializeNdjson([{ downloads: 1, day: '2026-06-28', package: '@x/y' }])).toBe(
      '{"package":"@x/y","day":"2026-06-28","downloads":1}\n'
    )
  })
})

describe('parseNdjson', () => {
  it('round-trips what serializeNdjson wrote', () => {
    expect(parseNdjson(serializeNdjson(RECORDS), 'features.ndjson')).toEqual(RECORDS)
  })

  it('tolerates a blank line', () => {
    expect(parseNdjson('\n{"package":"@x/y","day":"2026-06-28","downloads":1}\n\n', 'f')).toHaveLength(1)
  })

  it('rejects a line that is not JSON, naming the line', () => {
    expect(() => parseNdjson('{"package":"@x/y","day":"2026-06-28","downloads":1}\n{oops\n', 'features.ndjson')).toThrow(
      'features.ndjson:2 is not JSON'
    )
  })

  it('rejects a line that is not a record', () => {
    expect(kindOf('[1,2]\n')).toBe('dataset-corrupt')
  })

  it('rejects a record without a package', () => {
    expect(kindOf('{"day":"2026-06-28","downloads":1}\n')).toBe('dataset-corrupt')
  })

  it('rejects a malformed day', () => {
    expect(kindOf('{"package":"@x/y","day":"2026-13-01","downloads":1}\n')).toBe('dataset-corrupt')
  })

  it('rejects a fractional count', () => {
    expect(kindOf('{"package":"@x/y","day":"2026-06-28","downloads":1.5}\n')).toBe('dataset-corrupt')
  })

  it('rejects a count written as a string', () => {
    expect(kindOf('{"package":"@x/y","day":"2026-06-28","downloads":"1"}\n')).toBe('dataset-corrupt')
  })
})
