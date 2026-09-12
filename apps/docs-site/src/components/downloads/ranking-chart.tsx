'use client'

import type { PackageDownloads } from '@/lib/downloads'
import { PackageIcon } from '@/components/package/package-icon'
import { formatCompactCount, formatExactCount } from '@/lib/downloads-route'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Props for {@link RankingChart}. */
export interface RankingChartProps {
  /** Every tracked package, most downloaded first */
  packages: PackageDownloads[]
  /** The package the page is focused on, or null for none */
  focused: string | null
  /** Called when a bar is chosen; with null when the focused bar is chosen again */
  onFocus: (packageName: string | null) => void
}

/**
 * Every package's total, as a bar each, longest first.
 *
 * Horizontal rather than vertical because a package name is a word, and
 * words are read left to right beside the thing they name. Each row is a
 * button that focuses its package, so the ranking is also the way into the
 * detail; the bar's length is the total against the largest total, and the
 * value is written at its tip in the text colour rather than being read off
 * an axis. When a package is focused the others step back rather than
 * disappearing, so the focused one keeps its place in the whole.
 * @param props - See {@link RankingChartProps}.
 * @param props.packages - Every tracked package, most downloaded first
 * @param props.focused - The package the page is focused on
 * @param props.onFocus - Called when a bar is chosen
 * @returns The chart.
 */
export function RankingChart({ packages, focused, onFocus }: RankingChartProps) {
  const largest = packages.reduce((peak, entry) => max(peak, entry.total), 0)

  return (
    <ol className={`ranking ${focused === null ? '' : 'ranking--focused'}`} aria-label="Packages ranked by total npm downloads">
      {packages.map((entry, index) => {
        const active = entry.package === focused
        return (
          <li key={entry.package} className={`ranking__row ${active ? 'ranking__row--active' : ''}`}>
            <button
              type="button"
              className="ranking__bar-button"
              onClick={() => onFocus(active ? null : entry.package)}
              aria-pressed={active}
              aria-label={`${entry.package}, ${formatExactCount(entry.total)} downloads, ranked ${index + 1} of ${packages.length}. ${active ? 'Clear focus' : 'Focus this package'}`}
              title={`${formatExactCount(entry.total)} downloads`}
            >
              <span className="ranking__name">
                <PackageIcon packageName={entry.package} className="ranking__mark" />
                <span className="ranking__short">{entry.package.replace(/^@[^/]+\//, '')}</span>
              </span>
              <span className="ranking__track">
                <span className="ranking__bar" style={{ width: `${largest === 0 ? 0 : (entry.total / largest) * 100}%` }} />
              </span>
              <span className="ranking__value">{formatCompactCount(entry.total)}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
