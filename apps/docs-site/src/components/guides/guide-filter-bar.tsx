'use client'

import type { GuideFilter } from '@/lib/guide-filters'
import type { GuidePackageOption } from '@/lib/guides'
import { PackagePill } from '@/components/guides/package-pill'
import { buildGuidesHref, GUIDE_FILTER_ALL } from '@/lib/guide-filters'
import { GUIDE_TYPE_GROUPS } from '@/lib/guide-labels'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { setTimeout, clearTimeout } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'

/** How long the reader stops typing before the search reaches the URL. */
const SEARCH_DEBOUNCE_MS = 250

/** How many package pills the row offers before the rest go behind a toggle; enough to fill one row on a docs page, and four on a phone. */
const VISIBLE_PACKAGE_LIMIT = 8

type IconProps = { className?: string }

interface GuideFilterBarProps {
  /** The view's current facets, as read from the URL */
  filter: GuideFilter
  /** Every documented package with the number of guides that involve it */
  packageOptions: GuidePackageOption[]
  /** The document types the corpus actually holds */
  presentTypes: string[]
  /** How many guides the current view shows */
  resultCount: number
  /** How many guides the corpus holds in total */
  totalCount: number
}

/**
 * The guides index's discovery controls: a search over the corpus, the
 * document-type chips, and one clickable pill per package.
 *
 * Every control is a link carrying the whole view in its href, so a narrowed
 * view can be shared, opened in a new tab, and walked back through with the
 * browser's own history. The search input is the exception: it holds the
 * reader's keystrokes locally and reaches the URL once they pause, so typing
 * never costs a history entry.
 * @param props - Component props
 * @param props.filter - The view's current facets
 * @param props.packageOptions - Every documented package with its guide count
 * @param props.presentTypes - The document types the corpus actually holds
 * @param props.resultCount - How many guides the current view shows
 * @param props.totalCount - How many guides the corpus holds in total
 * @returns The rendered filter bar
 */
export function GuideFilterBar({ filter, packageOptions, presentTypes, resultCount, totalCount }: GuideFilterBarProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(filter.query)
  const [showEveryPackage, setShowEveryPackage] = useState(false)
  // why: The query last written to the URL, so the input can tell its own echo from a navigation somebody else made
  const written = useRef(filter.query)

  // why: An external change (back, a cleared filter, a shared link) pulls the input with it; the input's own writes must not bounce back and move the caret mid-word
  useEffect(() => {
    if (filter.query === written.current) return
    written.current = filter.query
    setDraft(filter.query)
  }, [filter.query])

  useEffect(() => {
    // why: The URL carries the trimmed query, so trailing whitespace is not yet a different search and must not cost a navigation
    if (draft.trim() === written.current) return
    const timer = setTimeout(() => {
      written.current = draft.trim()
      // why: replace rather than push, or every keystroke would become a step the reader has to walk back through
      router.replace(buildGuidesHref({ package: filter.package, type: filter.type, query: draft }), { scroll: false })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, filter.package, filter.type, router])

  // why: The active package leads so a filter chosen from deep in the list stays visible once the rest collapse
  const offered = packageOptions
    .filter((option) => option.guideCount > 0 || option.packageName === filter.package)
    .sort((a, b) => {
      const aActive = a.packageName === filter.package ? 0 : 1
      const bActive = b.packageName === filter.package ? 0 : 1
      return aActive - bActive || b.guideCount - a.guideCount || a.packageName.localeCompare(b.packageName)
    })
  const shown = showEveryPackage ? offered : offered.slice(0, VISIBLE_PACKAGE_LIMIT)
  const narrowed = filter.package !== GUIDE_FILTER_ALL || filter.type !== GUIDE_FILTER_ALL || filter.query !== ''

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search guides by title, package, or what they cover"
          aria-label="Search guides"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-primary-600 dark:focus:ring-primary-900"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter guides by type">
          <TypeChip label="All" href={buildGuidesHref({ ...filter, type: GUIDE_FILTER_ALL })} active={filter.type === GUIDE_FILTER_ALL} />
          {GUIDE_TYPE_GROUPS.filter((group) => presentTypes.includes(group.value) || filter.type === group.value).map((group) => (
            <TypeChip
              key={group.value}
              label={group.chip}
              href={buildGuidesHref({ ...filter, type: group.value })}
              active={filter.type === group.value}
            />
          ))}
        </div>
        <p className="ml-auto text-sm text-slate-500 dark:text-slate-400">
          {resultCount} of {totalCount} guides
        </p>
        {narrowed ? (
          <Link
            href={buildGuidesHref()}
            className="rounded-full px-2.5 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
          >
            Clear all
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter guides by package">
        {shown.map((option) => (
          <PackagePill
            key={option.packageName}
            packageName={option.packageName}
            count={option.guideCount}
            active={filter.package === option.packageName}
            href={buildGuidesHref({
              ...filter,
              package: filter.package === option.packageName ? GUIDE_FILTER_ALL : option.packageName,
            })}
          />
        ))}
        {offered.length > shown.length || showEveryPackage ? (
          <button
            type="button"
            onClick={() => setShowEveryPackage(!showEveryPackage)}
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {showEveryPackage ? 'Show fewer' : `+${offered.length - shown.length} more`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

interface TypeChipProps {
  /** Chip label */
  label: string
  /** The view this chip selects */
  href: string
  /** Whether this chip is the active filter */
  active: boolean
}

function TypeChip({ label, href, active }: TypeChipProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white dark:bg-primary-500'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </Link>
  )
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  )
}
