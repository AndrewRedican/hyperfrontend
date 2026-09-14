import type { Granularity, TrendPoint } from './npm-downloads/aggregate'
import { createDate, dateUTC } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { formatArticleDate } from './article-format'
import { niceCeiling, peakOf } from './npm-downloads/aggregate'

/** Short month names, for tick labels that have to fit. */
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** What a fold is called on a chart. */
export const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
}

/**
 * A day as a short tick, `Sep 10`, or `Sep 2026` when the year matters more than the day.
 *
 * @param day - A `YYYY-MM-DD` day
 * @param withYear - Whether to write the year instead of the day
 * @returns The tick text
 *
 * @example
 * ```typescript
 * shortDay('2026-09-10') // 'Sep 10'
 * shortDay('2026-09-10', true) // 'Sep 2026'
 * ```
 */
export function shortDay(day: string, withYear = false): string {
  const month = SHORT_MONTHS[Number(day.slice(5, 7)) - 1] ?? day.slice(5, 7)
  return withYear ? `${month} ${day.slice(0, 4)}` : `${month} ${Number(day.slice(8, 10))}`
}

/**
 * What a bucket is called in a tooltip: a day, a span of days, or a month.
 *
 * @param point - The bucket being named
 * @param granularity - The fold the chart is drawn at
 * @returns What to call it
 *
 * @example
 * ```typescript
 * bucketLabel({ start: '2026-08-31', end: '2026-09-06', downloads: 84 }, 'weekly') // 'Aug 31 – Sep 6, 2026'
 * bucketLabel({ start: '2026-08-01', end: '2026-08-31', downloads: 900 }, 'monthly') // 'August 2026'
 * ```
 */
export function bucketLabel(point: TrendPoint, granularity: Granularity): string {
  if (granularity === 'daily') return formatArticleDate(point.start)
  if (granularity === 'monthly' && point.end.slice(0, 7) === point.start.slice(0, 7)) {
    const [month] = formatArticleDate(point.start).split(' ')
    return point.end < bucketMonthEnd(point.start)
      ? `${month} ${point.start.slice(0, 4)} (to ${shortDay(point.end)})`
      : `${month} ${point.start.slice(0, 4)}`
  }
  return `${shortDay(point.start)} – ${shortDay(point.end)}, ${point.end.slice(0, 4)}`
}

/**
 * The last day of the month a day falls in, for telling a full month from an open one.
 *
 * @param day - Any day in the month
 * @returns The month's last day
 */
function bucketMonthEnd(day: string): string {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const lastDate = createDate(dateUTC(year, month, 0)).getUTCDate()
  return `${day.slice(0, 7)}-${String(lastDate).padStart(2, '0')}`
}

/** One value-axis tick. */
export interface ValueTick {
  /** The value the tick stands for */
  value: number
  /** Where it sits, in the chart's own units */
  y: number
}

/** One date-axis tick. */
export interface DateTick {
  /** The point the tick sits on */
  index: number
  /** Where it sits, in the chart's own units */
  x: number
  /** What it says */
  label: string
}

/** The drawing of a trend, in the chart's own coordinates. */
export interface TrendGeometry {
  /** Each point's x, evenly spaced across the plot */
  xs: number[]
  /** Each point's y, zero at the plot's bottom */
  ys: number[]
  /** The line through the points, as an SVG path */
  linePath: string
  /** The area under the line, closed to the baseline, as an SVG path */
  areaPath: string
  /** The value the top of the plot stands for */
  ceiling: number
  /** Y-axis ticks, bottom to top */
  yTicks: ValueTick[]
  /** X-axis ticks, left to right */
  xTicks: DateTick[]
}

/** Where the plot sits inside the chart's box. */
export interface PlotInsets {
  /** Space above the plot */
  top: number
  /** Space to the right */
  right: number
  /** Space below, for x labels */
  bottom: number
  /** Space to the left, for y labels */
  left: number
}

/**
 * Lay a trend out in a box.
 *
 * Points are spaced evenly, because the buckets are contiguous and equal
 * and a chart of a hundred weeks should read as a hundred equal steps. The
 * value axis runs from zero to a clean ceiling above the peak, so the axis
 * reads as round numbers rather than as the data's own maximum. A history
 * of one point is drawn as that point alone rather than a line to nowhere.
 *
 * @param points - The folded points
 * @param width - The box's width
 * @param height - The box's height
 * @param insets - The plot's insets inside the box
 * @param xTickCount - How many x ticks to place, at most
 * @param yTickCount - How many y ticks to place, at most
 * @returns The geometry
 *
 * @example
 * ```typescript
 * const geometry = layoutTrend(points, 320, 120, { top: 8, right: 8, bottom: 8, left: 8 }, 0, 0)
 * ```
 */
export function layoutTrend(
  points: readonly TrendPoint[],
  width: number,
  height: number,
  insets: PlotInsets,
  xTickCount: number,
  yTickCount: number
): TrendGeometry {
  const ceiling = niceCeiling(peakOf(points))
  const plotWidth = max(1, width - insets.left - insets.right)
  const plotHeight = max(1, height - insets.top - insets.bottom)
  const count = points.length
  const step = count > 1 ? plotWidth / (count - 1) : 0
  const xs = points.map((_, index) => round((insets.left + (count > 1 ? index * step : plotWidth / 2)) * 100) / 100)
  const ys = points.map((point) => round((insets.top + plotHeight - (point.downloads / ceiling) * plotHeight) * 100) / 100)
  const baseline = insets.top + plotHeight

  const linePath = xs.map((x, index) => `${index === 0 ? 'M' : 'L'}${x} ${ys[index]}`).join(' ')
  const areaPath = count === 0 ? '' : `${linePath} L${xs[count - 1]} ${baseline} L${xs[0]} ${baseline} Z`

  const yTicks: TrendGeometry['yTicks'] = []
  for (let tick = 0; yTickCount > 0 && tick <= yTickCount; tick += 1) {
    const value = round((ceiling * tick) / yTickCount)
    yTicks.push({ value, y: round((baseline - (value / ceiling) * plotHeight) * 100) / 100 })
  }

  const xTicks: TrendGeometry['xTicks'] = []
  if (xTickCount > 0 && count > 0) {
    const ticks = count === 1 ? 1 : max(2, xTickCount)
    const spanYears = points[0].start.slice(0, 4) !== points[count - 1].end.slice(0, 4)
    for (let tick = 0; tick < ticks; tick += 1) {
      const index = ticks === 1 ? 0 : round((tick * (count - 1)) / (ticks - 1))
      if (xTicks.some((existing) => existing.index === index)) continue
      xTicks.push({ index, x: xs[index], label: shortDay(points[index].start, spanYears) })
    }
  }

  return { xs, ys, linePath, areaPath, ceiling, yTicks, xTicks }
}

/**
 * The point nearest a horizontal position, for a hover readout.
 *
 * @param xs - Each point's x
 * @param x - The pointer's x, in the same coordinates
 * @returns The index of the nearest point, or -1 for no points
 *
 * @example
 * ```typescript
 * nearestIndex([10, 20, 30], 24) // 1
 * ```
 */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = -1
  let bestDistance = Infinity
  xs.forEach((candidate, index) => {
    const distance = candidate > x ? candidate - x : x - candidate
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  })
  return best
}
