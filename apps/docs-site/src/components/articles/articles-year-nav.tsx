'use client'

import { useReachedAnchor } from '@/hooks/use-reached-anchor'
import { yearAnchor } from '@/lib/article-filters'
import { useMemo } from 'react'
import { ACTIVE_EDGE, ACTIVE_TEXT, INACTIVE_TEXT } from '../document/rail-styles'

/** Props for {@link ArticlesYearNav}. */
export interface ArticlesYearNavProps {
  /** The years with articles on the index, newest first */
  years: string[]
}

/**
 * The years an index of articles spans, as a way of moving between them.
 *
 * The same family as the document index beside a long page: a rail of plain
 * anchors that highlights whichever entry the reader has scrolled into, by
 * the same reading-position rule. The years are whatever the articles say
 * they are, so a corpus that spans one year offers one entry and grows the
 * list as it grows.
 *
 * From the medium breakpoint up it stands beside the list as a column,
 * sticky under the header. Below that the column would take a phone's width
 * from the articles, so the same entries are laid along one line above them
 * instead, scrolling sideways if a decade ever needs it to.
 * @param props - See {@link ArticlesYearNavProps}.
 * @param props.years - The years on the index, newest first
 * @returns The navigation, or nothing when there are no years.
 * @example
 * ```tsx
 * <ArticlesYearNav years={groups.map((group) => group.year)} />
 * ```
 */
export function ArticlesYearNav({ years }: ArticlesYearNavProps) {
  const anchors = useMemo(() => years.map(yearAnchor), [years])
  const active = useReachedAnchor(anchors)

  if (years.length === 0) return null

  return (
    <nav aria-label="Articles by year" className="md:sticky md:top-20 md:w-20 md:shrink-0 md:self-start">
      <p className="mb-3 hidden text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 md:block">Years</p>
      {/* why: the rail's guide line is spelled out with its breakpoint rather than composed from the shared constant, because Tailwind only emits class names it can read whole from the source */}
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:border-l md:border-slate-200 md:px-0 md:dark:border-slate-800">
        {years.map((year) => {
          const anchor = yearAnchor(year)
          const isActive = anchor === active
          return (
            <li key={year} className="shrink-0">
              <a
                href={`#${anchor}`}
                aria-current={isActive ? 'location' : undefined}
                className={`block border-b-2 px-2 py-1 font-mono text-sm tabular-nums transition-colors md:-ml-px md:border-b-0 md:border-l md:px-0 md:pl-3 ${
                  isActive ? `${ACTIVE_EDGE} ${ACTIVE_TEXT}` : `border-transparent ${INACTIVE_TEXT}`
                }`}
              >
                {year}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
