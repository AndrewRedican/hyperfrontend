'use client'

import type { ChangelogFilter } from '@/lib/changelog-filters'
import { isFiltering, parseQuery } from '@/lib/changelog-filters'
import { useId } from 'react'

/** Props for {@link ChangelogFilterBar}. */
export interface ChangelogFilterBarProps {
  /** What the reader has asked for */
  filter: ChangelogFilter
  /** Called with the whole filter whenever one axis changes */
  onChange: (filter: ChangelogFilter) => void
  /** How many releases survive the filter */
  resultCount: number
  /** How many releases there are in all */
  totalCount: number
}

/** The shared look of the three fields. */
const FIELD_CLASSES =
  'h-10 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white'

/**
 * One row of controls over a release history: a search that reads words and
 * version ranges alike, and a day range beside it.
 *
 * One box rather than three for the things a reader types, because a reader
 * does not think in axes: `security ^0.9` is one question. The box says how
 * it read what was typed, so a range that was meant as words, or words that
 * were meant as a range, are caught at a glance. The dates are separate
 * because a date is picked rather than typed, and a picker is the control
 * for that.
 * @param props - See {@link ChangelogFilterBarProps}.
 * @param props.filter - What the reader has asked for
 * @param props.onChange - Called whenever one axis changes
 * @param props.resultCount - How many releases survive
 * @param props.totalCount - How many there are in all
 * @returns The controls.
 */
export function ChangelogFilterBar({ filter, onChange, resultCount, totalCount }: ChangelogFilterBarProps) {
  const searchId = useId()
  const fromId = useId()
  const toId = useId()
  const parsed = parseQuery(filter.query)
  const active = isFiltering(filter)

  return (
    <div className="changelog-filters" role="search" aria-label="Filter releases">
      <div className="changelog-filters__row">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search releases by words, version or version range
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id={searchId}
            type="search"
            value={filter.query}
            onChange={(event) => onChange({ ...filter, query: event.target.value })}
            placeholder="Search notes, a version, or a range like ^0.9"
            autoComplete="off"
            spellCheck={false}
            className={`${FIELD_CLASSES} w-full pl-9 pr-3`}
          />
        </div>

        <div className="changelog-filters__dates">
          <label htmlFor={fromId} className="changelog-filters__date-label">
            From
          </label>
          <input
            id={fromId}
            type="date"
            value={filter.from}
            max={filter.to || undefined}
            onChange={(event) => onChange({ ...filter, from: event.target.value })}
            className={`${FIELD_CLASSES} px-2`}
            aria-label="Earliest release date"
          />
          <label htmlFor={toId} className="changelog-filters__date-label">
            To
          </label>
          <input
            id={toId}
            type="date"
            value={filter.to}
            min={filter.from || undefined}
            onChange={(event) => onChange({ ...filter, to: event.target.value })}
            className={`${FIELD_CLASSES} px-2`}
            aria-label="Latest release date"
          />
        </div>
      </div>

      <p className="changelog-filters__status" aria-live="polite">
        {active ? (
          <>
            <span>
              {resultCount === totalCount ? `All ${totalCount}` : `${resultCount} of ${totalCount}`}{' '}
              {totalCount === 1 ? 'release' : 'releases'}
            </span>
            {parsed.range !== null ? (
              <span className="changelog-filters__reading">
                matching <code>{parsed.range}</code>
              </span>
            ) : null}
            {parsed.terms.length > 0 ? (
              <span className="changelog-filters__reading">
                mentioning{' '}
                {parsed.terms.map((term, index) => (
                  <span key={term}>
                    {index > 0 ? ', ' : ''}
                    <code>{term}</code>
                  </span>
                ))}
              </span>
            ) : null}
            <button type="button" onClick={() => onChange({ query: '', from: '', to: '' })} className="changelog-filters__clear">
              Clear
            </button>
          </>
        ) : (
          <span>
            {totalCount} {totalCount === 1 ? 'release' : 'releases'}, newest first
          </span>
        )}
      </p>
    </div>
  )
}

/** Props for the inline icon. */
interface IconProps {
  /** Sizing and colour classes */
  className?: string
}

/**
 * A magnifier.
 * @param props - See {@link IconProps}.
 * @param props.className - Sizing and colour classes
 * @returns The icon.
 */
function SearchIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}
