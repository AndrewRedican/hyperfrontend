'use client'

import type { LightboxMedia } from '@/components/media/media-lightbox'
import type { DownloadsSnapshot, PackageDownloads } from '@/lib/downloads'
import type { Trend } from '@/lib/npm-downloads/aggregate'
import { MediaLightbox } from '@/components/media/media-lightbox'
import { PackageIcon } from '@/components/package/package-icon'
import { formatArticleDate } from '@/lib/article-format'
import { buildDownloadsHref, formatCompactCount, formatExactCount, readDownloadsFocus } from '@/lib/downloads-route'
import { GRANULARITY_LABELS } from '@/lib/downloads-view'
import { foldTrend } from '@/lib/npm-downloads/aggregate'
import { daysInclusive } from '@/lib/npm-downloads/dates'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { RankingChart } from './ranking-chart'
import { TrendChart } from './trend-chart'

/** Props for {@link DownloadsDashboard}. */
export interface DownloadsDashboardProps {
  /** Everything the page draws from, read at build time */
  snapshot: DownloadsSnapshot
}

/** The drawing box of a compact chart in the grid, in its own units. */
const COMPACT_WIDTH = 320

/** @see {@link COMPACT_WIDTH} */
const COMPACT_HEIGHT = 120

/** The drawing box of an expanded chart, in CSS pixels. */
const EXPANDED_WIDTH = 1100

/** @see {@link EXPANDED_WIDTH} */
const EXPANDED_HEIGHT = 540

/**
 * The downloads page below its title: the ranking, the focused package's
 * detail, and every package's trend.
 *
 * Which package is focused lives in the URL, so a focused view can be
 * linked to from a package's own page and shared as it stands. Focusing
 * emphasizes rather than filters: the ranking keeps every bar and dims the
 * others, and the grid keeps every chart and rings the focused one, because
 * a number only means something beside the numbers around it.
 * @param props - See {@link DownloadsDashboardProps}.
 * @param props.snapshot - Everything the page draws from
 * @returns The dashboard.
 */
export function DownloadsDashboard({ snapshot }: DownloadsDashboardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const names = useMemo(() => snapshot.packages.map((entry) => entry.package), [snapshot])
  const focused = useMemo(() => readDownloadsFocus(searchParams, names), [searchParams, names])
  const [expanded, setExpanded] = useState<string | null>(null)
  const focusedRef = useRef<HTMLElement | null>(null)

  const trends = useMemo(
    () => createMap(snapshot.packages.map((entry): [string, Trend] => [entry.package, foldTrend(entry.days)])),
    [snapshot]
  )
  const byName = useMemo(() => createMap(snapshot.packages.map((entry): [string, PackageDownloads] => [entry.package, entry])), [snapshot])

  const setFocus = useCallback(
    (packageName: string | null) => {
      router.replace(buildDownloadsHref(packageName ?? undefined), { scroll: false })
    },
    [router]
  )

  // why: a link straight to a package is a request to see it, so its detail scrolls into view on arrival
  useEffect(() => {
    if (focused === null || focusedRef.current === null) return
    focusedRef.current.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [focused])

  const expandedEntry = expanded === null ? null : byName.get(expanded)
  const expandedTrend = expanded === null ? null : trends.get(expanded)
  const expandedMedia = useMemo((): LightboxMedia | null => {
    if (expandedEntry === undefined || expandedEntry === null || expandedTrend === undefined || expandedTrend === null) return null
    return {
      kind: 'node',
      width: EXPANDED_WIDTH,
      height: EXPANDED_HEIGHT + 96,
      node: (
        <div className="trend-expanded" style={{ width: EXPANDED_WIDTH }}>
          <header className="trend-expanded__header">
            <PackageIcon packageName={expandedEntry.package} className="h-6 w-6 text-slate-500 dark:text-slate-400" />
            <span className="font-mono text-base font-semibold text-slate-900 dark:text-white">{expandedEntry.package}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {formatExactCount(expandedEntry.total)} downloads · {GRANULARITY_LABELS[expandedTrend.granularity]} ·{' '}
              {formatArticleDate(expandedEntry.firstDay)} to {formatArticleDate(expandedEntry.lastDay)}
            </span>
          </header>
          <TrendChart
            points={expandedTrend.points}
            granularity={expandedTrend.granularity}
            packageName={expandedEntry.package}
            width={EXPANDED_WIDTH}
            height={EXPANDED_HEIGHT}
            detailed
            emphasized={expandedEntry.package === focused}
          />
        </div>
      ),
    }
  }, [expandedEntry, expandedTrend, focused])

  const focusedEntry = focused === null ? null : (byName.get(focused) ?? null)
  const focusedTrend = focused === null ? null : (trends.get(focused) ?? null)

  return (
    <div className="downloads">
      <div className="downloads__controls">
        <label htmlFor="downloads-focus" className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Focus
        </label>
        <select
          id="downloads-focus"
          value={focused ?? ''}
          onChange={(event) => setFocus(event.target.value === '' ? null : event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="">Whole ecosystem</option>
          {snapshot.packages.map((entry) => (
            <option key={entry.package} value={entry.package}>
              {entry.package}
            </option>
          ))}
        </select>
        {focused !== null ? (
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Clear focus
          </button>
        ) : null}
      </div>

      <section className="mt-8" aria-labelledby="downloads-ranking">
        <h2 id="downloads-ranking" className="downloads__heading">
          Ranking
        </h2>
        <p className="downloads__lede">
          Total npm downloads of every tracked package, most downloaded first. Choose a bar to focus a package.
        </p>
        <RankingChart packages={snapshot.packages} focused={focused} onFocus={setFocus} />
      </section>

      {focusedEntry !== null && focusedTrend !== null ? (
        <section className="downloads__focus mt-10" aria-labelledby="downloads-focused" ref={focusedRef}>
          <h2 id="downloads-focused" className="downloads__heading">
            <PackageIcon packageName={focusedEntry.package} className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <span className="font-mono">{focusedEntry.package}</span>
          </h2>
          <dl className="downloads__facts">
            <div>
              <dt>Total downloads</dt>
              <dd>{formatExactCount(focusedEntry.total)}</dd>
            </div>
            <div>
              <dt>Tracked since</dt>
              <dd>{formatArticleDate(focusedEntry.firstDay)}</dd>
            </div>
            <div>
              <dt>Through</dt>
              <dd>{formatArticleDate(focusedEntry.lastDay)}</dd>
            </div>
            <div>
              <dt>Days tracked</dt>
              <dd>{formatExactCount(daysInclusive(focusedEntry.firstDay, focusedEntry.lastDay))}</dd>
            </div>
          </dl>
          <ExpandableCard
            className="trend-card trend-card--wide"
            label={`Expand the ${focusedEntry.package} chart`}
            onExpand={() => setExpanded(focusedEntry.package)}
          >
            <TrendChart
              points={focusedTrend.points}
              granularity={focusedTrend.granularity}
              packageName={focusedEntry.package}
              width={COMPACT_WIDTH * 3}
              height={COMPACT_HEIGHT * 1.4}
              emphasized
            />
            <span className="trend-card__foot">
              <span>{GRANULARITY_LABELS[focusedTrend.granularity]}</span>
              <span>Click to expand</span>
            </span>
          </ExpandableCard>
        </section>
      ) : null}

      <section className="mt-10" aria-labelledby="downloads-trends">
        <h2 id="downloads-trends" className="downloads__heading">
          Trends
        </h2>
        <p className="downloads__lede">
          Every package&apos;s history, most downloaded first. Each chart chooses the finest step its history can carry: days for a young
          package, weeks or months as it ages. Expand one for axes and a readout.
        </p>
        <ul className="trend-grid">
          {snapshot.packages.map((entry) => {
            const trend = trends.get(entry.package)
            if (trend === undefined) return null
            const active = entry.package === focused
            return (
              <li key={entry.package}>
                <ExpandableCard
                  className={`trend-card ${active ? 'trend-card--active' : ''}`}
                  label={`Expand the ${entry.package} chart: ${formatExactCount(entry.total)} downloads`}
                  onExpand={() => setExpanded(entry.package)}
                >
                  <span className="trend-card__head">
                    <PackageIcon packageName={entry.package} className="trend-card__mark" />
                    <span className="trend-card__name">{entry.package.replace(/^@[^/]+\//, '')}</span>
                    <span className="trend-card__total">{formatCompactCount(entry.total)}</span>
                  </span>
                  <TrendChart
                    points={trend.points}
                    granularity={trend.granularity}
                    packageName={entry.package}
                    width={COMPACT_WIDTH}
                    height={COMPACT_HEIGHT}
                    emphasized={active}
                  />
                  <span className="trend-card__foot">
                    <span>{GRANULARITY_LABELS[trend.granularity]}</span>
                    <span>
                      {formatArticleDate(entry.firstDay)} – {formatArticleDate(entry.lastDay)}
                    </span>
                  </span>
                </ExpandableCard>
              </li>
            )
          })}
        </ul>
      </section>

      {expandedMedia !== null && expandedEntry !== undefined && expandedEntry !== null ? (
        <MediaLightbox
          media={expandedMedia}
          label={`Expanded chart: ${expandedEntry.package} downloads`}
          isOpen
          onClose={() => setExpanded(null)}
        />
      ) : null}
    </div>
  )
}

/** Props for {@link ExpandableCard}. */
interface ExpandableCardProps {
  /** Classes on the card */
  className: string
  /** What activating the card does, for a screen reader */
  label: string
  /** Called when the card is activated by pointer or keyboard */
  onExpand: () => void
  /** The card's contents */
  children: React.ReactNode
}

/**
 * A card that opens its chart in the lightbox, the way a diagram does.
 *
 * A container with a button's role rather than a button element, because
 * the chart inside carries its own hover readout and a button may hold only
 * phrasing content; the keyboard gets Enter and Space, the same as it would
 * from a button.
 * @param props - See {@link ExpandableCardProps}.
 * @param props.className - Classes on the card
 * @param props.label - What activating the card does
 * @param props.onExpand - Called when the card is activated
 * @param props.children - The card's contents
 * @returns The card.
 */
function ExpandableCard({ className, label, onExpand, children }: ExpandableCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={className}
      onClick={onExpand}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onExpand()
        }
      }}
      aria-label={label}
      aria-haspopup="dialog"
    >
      {children}
    </div>
  )
}
