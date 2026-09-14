'use client'

import type { Granularity, TrendPoint } from '@/lib/npm-downloads/aggregate'
import { formatExactCount } from '@/lib/downloads-route'
import { bucketLabel, GRANULARITY_LABELS, layoutTrend, nearestIndex } from '@/lib/downloads-view'
import { useId, useMemo, useState } from 'react'

/** Props for {@link TrendChart}. */
export interface TrendChartProps {
  /** The folded points, oldest first */
  points: TrendPoint[]
  /** The fold the points are at, so a readout can name a bucket */
  granularity: Granularity
  /** Full npm package name, for the chart's accessible name */
  packageName: string
  /** Width of the drawing box, in its own units */
  width: number
  /** Height of the drawing box, in its own units */
  height: number
  /** Draw axes with ticks, for a chart large enough to read them */
  detailed?: boolean
  /** Draw the series in the emphasis colour, for a focused package */
  emphasized?: boolean
}

/**
 * One package's downloads over time: an area under a line, with a readout
 * that follows the pointer.
 *
 * The same drawing at two sizes. In the grid it is compact: the line, its
 * wash, the last point, and nothing else, because twenty of them are read
 * together and axes on each would be forty axes. Expanded it is detailed:
 * value ticks, date ticks, and a gridline per tick, because now it is read
 * alone. Both carry the readout, which finds the bucket nearest the
 * pointer, so a reader aims at a week rather than at a two-pixel line, and
 * the readout names the bucket and its count in the text tokens, never in
 * the series colour.
 * @param props - See {@link TrendChartProps}.
 * @param props.points - The folded points
 * @param props.granularity - The fold the points are at
 * @param props.packageName - Full npm package name
 * @param props.width - Width of the drawing box
 * @param props.height - Height of the drawing box
 * @param props.detailed - Whether to draw axes
 * @param props.emphasized - Whether to draw the series emphasized
 * @returns The chart.
 */
export function TrendChart({ points, granularity, packageName, width, height, detailed = false, emphasized = false }: TrendChartProps) {
  const [hovered, setHovered] = useState(-1)
  const titleId = useId()
  const { geometry, insets } = useMemo(() => {
    const plotInsets = detailed ? { top: 16, right: 20, bottom: 32, left: 56 } : { top: 8, right: 8, bottom: 8, left: 8 }
    return { geometry: layoutTrend(points, width, height, plotInsets, detailed ? 6 : 0, detailed ? 5 : 0), insets: plotInsets }
  }, [points, width, height, detailed])
  const last = points.length - 1
  const total = points.reduce((sum, point) => sum + point.downloads, 0)

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    setHovered(nearestIndex(geometry.xs, ((event.clientX - box.left) / box.width) * width))
  }

  return (
    <div className={`trend-chart ${emphasized ? 'trend-chart--emphasized' : ''} ${detailed ? 'trend-chart--detailed' : ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-chart__svg"
        role="img"
        aria-labelledby={titleId}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHovered(-1)}
      >
        <title id={titleId}>
          {packageName}: {formatExactCount(total)} downloads over {points.length} {GRANULARITY_LABELS[granularity]} points
        </title>

        {detailed
          ? geometry.yTicks.map((tick) => (
              <g key={tick.value}>
                <line x1={insets.left} x2={width - insets.right} y1={tick.y} y2={tick.y} className="trend-chart__grid" />
                <text x={insets.left - 8} y={tick.y} className="trend-chart__tick" textAnchor="end" dominantBaseline="middle">
                  {formatExactCount(tick.value)}
                </text>
              </g>
            ))
          : null}

        {detailed
          ? geometry.xTicks.map((tick) => (
              <text
                key={tick.index}
                x={tick.x}
                y={height - 10}
                className="trend-chart__tick"
                textAnchor={tick.index === 0 ? 'start' : tick.index === last ? 'end' : 'middle'}
              >
                {tick.label}
              </text>
            ))
          : null}

        {geometry.areaPath !== '' ? <path d={geometry.areaPath} className="trend-chart__area" /> : null}
        {points.length > 1 ? <path d={geometry.linePath} className="trend-chart__line" /> : null}
        {last >= 0 ? <circle cx={geometry.xs[last]} cy={geometry.ys[last]} r={detailed ? 5 : 3.5} className="trend-chart__end" /> : null}

        {hovered >= 0 ? (
          <g className="trend-chart__cursor">
            <line
              x1={geometry.xs[hovered]}
              x2={geometry.xs[hovered]}
              y1={insets.top}
              y2={height - insets.bottom}
              className="trend-chart__hairline"
            />
            <circle cx={geometry.xs[hovered]} cy={geometry.ys[hovered]} r={detailed ? 5 : 3.5} className="trend-chart__end" />
          </g>
        ) : null}
      </svg>

      {hovered >= 0 ? (
        <div className="trend-chart__readout" style={{ left: `${(geometry.xs[hovered] / width) * 100}%` }} role="status">
          <strong>{formatExactCount(points[hovered].downloads)}</strong>
          <span>{bucketLabel(points[hovered], granularity)}</span>
        </div>
      ) : null}
    </div>
  )
}
