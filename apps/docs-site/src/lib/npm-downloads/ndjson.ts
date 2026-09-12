import type { DailyDownloads } from './model'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { isSafeInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { isDay } from './dates'
import { NpmStatsError } from './model'

/**
 * Serialize daily records as newline-delimited JSON.
 *
 * One record per line, keys in a fixed order, a trailing newline and no
 * wrapping array. Appending a day appends a line, correcting a day changes
 * one line, and a diff of the file is a diff of the data: that is what makes
 * a dataset that lives in version control reviewable. Every line names its
 * package, so a line read on its own, by a script or a person, still says
 * what it is.
 *
 * @param records - The records to write, in the order they should appear
 * @returns The file contents
 *
 * @example
 * ```typescript
 * serializeNdjson([{ package: '@hyperfrontend/features', day: '2026-06-28', downloads: 60 }])
 * // '{"package":"@hyperfrontend/features","day":"2026-06-28","downloads":60}\n'
 * ```
 */
export function serializeNdjson(records: readonly DailyDownloads[]): string {
  return records.map((record) => stringify({ package: record.package, day: record.day, downloads: record.downloads }) + '\n').join('')
}

/**
 * Parse newline-delimited JSON back into daily records, checking each line.
 *
 * Read strictly: a line that is not a record, names a malformed day, or
 * carries something other than a non-negative integer is an error naming
 * the file and the line, because a dataset that is committed and published
 * must not be able to drift into a shape its readers silently misread.
 *
 * @param text - The file contents
 * @param source - What to call the file in an error
 * @returns The records, in file order
 * @throws {NpmStatsError} Naming the first line that could not be read
 *
 * @example
 * ```typescript
 * parseNdjson('{"package":"@hyperfrontend/features","day":"2026-06-28","downloads":60}\n', 'features.ndjson')
 * // [{ package: '@hyperfrontend/features', day: '2026-06-28', downloads: 60 }]
 * ```
 */
export function parseNdjson(text: string, source: string): DailyDownloads[] {
  const records: DailyDownloads[] = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    // why: the trailing newline leaves one empty line at the end, and a blank line anywhere else is tolerated for the same reason a person might leave one
    if (line.trim() === '') continue
    let value: unknown
    try {
      value = parse(line)
    } catch {
      throw new NpmStatsError('dataset-corrupt', `${source}:${index + 1} is not JSON`)
    }
    if (typeof value !== 'object' || value === null || isArray(value)) {
      throw new NpmStatsError('dataset-corrupt', `${source}:${index + 1} is not a record`)
    }
    const record = value as Record<string, unknown>
    const packageName = record['package']
    const day = record['day']
    const downloads = record['downloads']
    if (typeof packageName !== 'string' || packageName === '') {
      throw new NpmStatsError('dataset-corrupt', `${source}:${index + 1} names no package`)
    }
    if (typeof day !== 'string' || !isDay(day)) {
      throw new NpmStatsError('dataset-corrupt', `${source}:${index + 1} carries a malformed day: ${String(day)}`)
    }
    if (typeof downloads !== 'number' || !isSafeInteger(downloads) || downloads < 0) {
      throw new NpmStatsError('dataset-corrupt', `${source}:${index + 1} carries a malformed count: ${String(downloads)}`)
    }
    records.push({ package: packageName, day, downloads })
  }
  return records
}
