'use client'

import type { Category } from '@/lib/ci/vocabulary'
import { CATEGORY_LABEL } from '@/lib/ci/vocabulary'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { TargetIcon } from './marks'

/** How many tasks of a category an execution has. */
export interface CategoryCount {
  /** The category */
  category: Category
  /** How many tasks */
  count: number
}

/** Props for {@link TimelineControls}. */
export interface TimelineControlsProps {
  /** The categories present, in chain order, with their counts */
  categories: readonly CategoryCount[]
  /** The categories the reader selected; empty for all */
  selected: ReadonlySet<Category>
  /** Flips a category */
  onToggle: (category: Category) => void
  /** Clears the selection */
  onClear: () => void
  /** Told the category under the pointer, or null */
  onHover: (category: Category | null) => void
  /** How far the timeline is zoomed */
  zoom: number
  /** Zooms in or out by a step */
  onZoom: (factor: number) => void
  /** Shows the whole run */
  onFit: () => void
}

/**
 * The timeline's toolbar: one pill per category of target, highlighting the matching tasks
 * while hovered and when selected, and the zoom.
 * @param props - See {@link TimelineControlsProps}.
 * @param props.categories
 * @param props.selected
 * @param props.onToggle
 * @param props.onClear
 * @param props.onHover
 * @param props.zoom
 * @param props.onZoom
 * @param props.onFit
 * @returns The toolbar
 */
export function TimelineControls({ categories, selected, onToggle, onClear, onHover, zoom, onZoom, onFit }: TimelineControlsProps) {
  const buttonClass =
    'rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div role="group" aria-label="Highlight targets" className="flex flex-wrap gap-1" onPointerLeave={() => onHover(null)}>
        {categories.map(({ category, count }) => {
          const on = selected.has(category)
          return (
            <button
              key={category}
              type="button"
              aria-pressed={on}
              title={`${CATEGORY_LABEL[category]} · ${count} tasks`}
              onClick={() => onToggle(category)}
              onPointerEnter={() => onHover(category)}
              onFocus={() => onHover(category)}
              onBlur={() => onHover(null)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                on
                  ? 'border-slate-700 bg-slate-800 text-white dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900'
                  : selected.size === 0
                    ? 'border-slate-300 text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-400'
                    : 'border-dashed border-slate-300 text-slate-500 hover:border-slate-500 dark:border-slate-600 dark:text-slate-400'
              }`}
            >
              <TargetIcon category={category} className="h-3 w-3" />
              {category}
              <span className={on ? 'opacity-70' : 'text-slate-400 dark:text-slate-500'}>{count}</span>
            </button>
          )
        })}
        {selected.size === 0 ? null : (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-2 py-0.5 text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            all
          </button>
        )}
      </div>
      <div role="group" aria-label="Zoom" className="ml-auto inline-flex items-center gap-1">
        <button type="button" onClick={() => onZoom(1 / 1.6)} disabled={zoom <= 1} className={buttonClass} aria-label="Zoom out">
          −
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {zoom < 10 ? round(zoom * 10) / 10 : round(zoom)}×
        </span>
        <button type="button" onClick={() => onZoom(1.6)} className={buttonClass} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={onFit} disabled={zoom <= 1} className={buttonClass}>
          Fit
        </button>
      </div>
    </div>
  )
}
