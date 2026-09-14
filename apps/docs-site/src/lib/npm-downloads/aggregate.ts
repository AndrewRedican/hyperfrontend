import type { Day } from './dates'
import type { DailyDownloads } from './model'
import { createDate, dateUTC } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { ceil, max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseInt as parseInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { addDays, dayToTime, daysInclusive, formatDay } from './dates'

/** A package's tracked history, summed. */
export interface PackageTotal {
  /** Full npm package name */
  package: string
  /** Sum of every stored daily count */
  total: number
  /** First stored day, or null for a package with no days yet */
  firstDay: Day | null
  /** Last stored day, or null for a package with no days yet */
  lastDay: Day | null
}

/** How daily records are folded for display. */
export type Granularity = 'daily' | 'weekly' | 'monthly'

/** One point on a trend chart: a bucket of days and their sum. */
export interface TrendPoint {
  /** First day in the bucket */
  start: Day
  /** Last day in the bucket, which is the frontier for a bucket still filling */
  end: Day
  /** Downloads summed over the bucket */
  downloads: number
}

/** A package's history folded for a chart. */
export interface Trend {
  /** The fold applied */
  granularity: Granularity
  /** The points, in order */
  points: TrendPoint[]
}

/**
 * Sum a package's history and note its span.
 *
 * @param packageName - Full npm package name
 * @param records - Its daily records, in day order
 * @returns The total and the first and last day it covers
 *
 * @example
 * ```typescript
 * summarize('@x/y', [{ package: '@x/y', day: '2026-09-01', downloads: 2 }, { package: '@x/y', day: '2026-09-02', downloads: 3 }])
 * // { package: '@x/y', total: 5, firstDay: '2026-09-01', lastDay: '2026-09-02' }
 * ```
 */
export function summarize(packageName: string, records: readonly DailyDownloads[]): PackageTotal {
  return {
    package: packageName,
    total: records.reduce((sum, record) => sum + record.downloads, 0),
    firstDay: records[0]?.day ?? null,
    lastDay: records[records.length - 1]?.day ?? null,
  }
}

/**
 * Order packages from most downloaded to least.
 *
 * Ties, which happen between fresh packages with a handful of downloads each,
 * fall back to name order so the ranking is stable between builds.
 *
 * @param totals - The packages to rank
 * @returns A new array, highest total first
 *
 * @example
 * ```typescript
 * rankPackages([{ package: 'b', total: 1, ... }, { package: 'a', total: 9, ... }]).map((p) => p.package) // ['a', 'b']
 * ```
 */
export function rankPackages(totals: readonly PackageTotal[]): PackageTotal[] {
  return [...totals].sort((a, b) => b.total - a.total || (a.package < b.package ? -1 : a.package > b.package ? 1 : 0))
}

/**
 * Sum every package's total into one ecosystem figure.
 *
 * This is a sum of raw npm package downloads, not of unique users or
 * installations: a package that depends on another in the ecosystem pulls
 * the second one down with it, and both are counted.
 *
 * @param totals - Every tracked package
 * @returns The sum
 *
 * @example
 * ```typescript
 * ecosystemTotal([{ total: 3, ... }, { total: 4, ... }]) // 7
 * ```
 */
export function ecosystemTotal(totals: readonly PackageTotal[]): number {
  return totals.reduce((sum, entry) => sum + entry.total, 0)
}

/**
 * Longest history, in days, a chart still draws day by day.
 *
 * At the site's chart width a day is a few pixels wide until roughly here;
 * past it the daily line is noise a reader has to squint through, and the
 * artificial spikes new packages get from crawlers and mirrors dominate the
 * picture.
 */
export const DAILY_MAX_DAYS = 60

/**
 * Longest history, in days, a chart draws week by week.
 *
 * Two years of weeks is around a hundred points, which is still legible;
 * past that a month is the unit a reader thinks in anyway.
 */
export const WEEKLY_MAX_DAYS = 730

/**
 * Pick how a history is folded for display from how long it is.
 *
 * The source stays daily; only the drawing changes. The thresholds are
 * chosen so a chart never has a handful of points sitting at one edge of an
 * empty plot, and never so many that individual days read as noise.
 *
 * @param days - How many days of history there are
 * @returns The fold to draw at
 *
 * @example A two-month-old package is drawn daily, an eight-month-old one weekly
 * ```typescript
 * chooseGranularity(58) // 'daily'
 * chooseGranularity(240) // 'weekly'
 * chooseGranularity(900) // 'monthly'
 * ```
 */
export function chooseGranularity(days: number): Granularity {
  if (days <= DAILY_MAX_DAYS) return 'daily'
  if (days <= WEEKLY_MAX_DAYS) return 'weekly'
  return 'monthly'
}

/**
 * The first day of the bucket a day falls in.
 *
 * Weeks start on Monday, so a weekly point is a calendar week a reader can
 * name; months start on the first.
 *
 * @param day - Any day
 * @param granularity - The fold
 * @returns The bucket's first day
 */
function bucketStart(day: Day, granularity: Granularity): Day {
  if (granularity === 'daily') return day
  if (granularity === 'monthly') return `${day.slice(0, 7)}-01`
  // why: getUTCDay is 0 for Sunday, and the week is anchored on Monday
  const weekday = (createDate(dayToTime(day)).getUTCDay() + 6) % 7
  return addDays(day, -weekday)
}

/**
 * The last day of the bucket that starts on a day.
 *
 * @param start - The bucket's first day
 * @param granularity - The fold
 * @returns The bucket's natural last day, before any clamping to the data
 */
function bucketEnd(start: Day, granularity: Granularity): Day {
  if (granularity === 'daily') return start
  if (granularity === 'weekly') return addDays(start, 6)
  // why: the first of the following month, one day back, is the month's end whatever its length
  return formatDay(dateUTC(parseInteger(start.slice(0, 4), 10), parseInteger(start.slice(5, 7), 10), 1) - 86_400_000)
}

/**
 * Fold daily records into the buckets a chart draws.
 *
 * Every bucket between the first and the last stored day is present, so a
 * week with no downloads is a point at zero rather than a gap the line
 * skips over. The last bucket may be partial: it runs to the last stored
 * day, and its `end` says so.
 *
 * @param records - A package's daily records, in day order
 * @param granularity - The fold to apply; chosen from the span when omitted
 * @returns The folded points
 *
 * @example Folding a fortnight into weeks
 * ```typescript
 * foldTrend(fortnight, 'weekly').points.length // 2 or 3, depending on where the Mondays fall
 * ```
 */
export function foldTrend(records: readonly Pick<DailyDownloads, 'day' | 'downloads'>[], granularity?: Granularity): Trend {
  const first = records[0]
  const last = records[records.length - 1]
  if (first === undefined || last === undefined) return { granularity: granularity ?? 'daily', points: [] }

  const chosen = granularity ?? chooseGranularity(daysInclusive(first.day, last.day))
  const sums = createMap<Day, number>()
  for (const record of records) {
    const key = bucketStart(record.day, chosen)
    sums.set(key, (sums.get(key) ?? 0) + record.downloads)
  }

  const points: TrendPoint[] = []
  for (const [start, downloads] of sums) {
    const naturalEnd = bucketEnd(start, chosen)
    points.push({ start, end: naturalEnd < last.day ? naturalEnd : last.day, downloads })
  }
  return { granularity: chosen, points }
}

/**
 * The largest count among a trend's points, for scaling a chart.
 *
 * @param points - A trend's folded points
 * @returns The maximum, or zero for no points
 *
 * @example
 * ```typescript
 * peakOf([{ downloads: 3, ... }, { downloads: 9, ... }]) // 9
 * ```
 */
export function peakOf(points: readonly TrendPoint[]): number {
  return points.reduce((peak, point) => max(peak, point.downloads), 0)
}

/**
 * A clean upper bound for a chart's value axis.
 *
 * Rounds the peak up to one, two, two and a half, or five times a power of ten, so the axis
 * ticks read as numbers a person would write rather than as the data's own
 * maximum.
 *
 * @param peak - The largest value drawn
 * @returns A bound at or above it, and at least one
 *
 * @example
 * ```typescript
 * niceCeiling(84) // 100
 * niceCeiling(130) // 200
 * niceCeiling(230) // 250
 * niceCeiling(3) // 5
 * ```
 */
export function niceCeiling(peak: number): number {
  if (peak <= 1) return 1
  const magnitude = 10 ** (String(ceil(peak)).length - 1)
  // why: a half step keeps a peak of 230 under 250 rather than 500, and is only offered where it still divides into whole ticks
  const steps = magnitude >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]
  for (const step of steps) {
    if (step * magnitude >= peak) return step * magnitude
  }
  return 10 * magnitude
}
