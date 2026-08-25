'use client'

import type { GuideFilter } from '@/lib/guide-filters'
import type { GuideIndexEntry, GuidePackageOption } from '@/lib/guides'
import { GuideCard } from '@/components/guides/guide-card'
import { GuideFilterBar } from '@/components/guides/guide-filter-bar'
import { SuggestGuideLink } from '@/components/guides/suggest-guide-link'
import { buildGuidesHref, filterGuides, GUIDE_FILTER_ALL, readGuideFilter } from '@/lib/guide-filters'
import { GUIDE_TYPE_GROUPS } from '@/lib/guide-labels'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

interface GuidesIndexListProps {
  /** Every compiled guide's index entry */
  guides: GuideIndexEntry[]
  /** Every documented package, including those without guides yet */
  packageOptions: GuidePackageOption[]
}

/**
 * Problem-first guide browser: a search over the corpus, chips and pills that
 * narrow it, and the results as a two-column grid of cards.
 *
 * Every facet lives in the URL rather than in component state, so a narrowed
 * view can be shared, bookmarked, linked from a package README, and walked
 * back through with the browser's own history. Browsing keeps the corpus
 * split by document type, because a tutorial and a how-to guide are different
 * promises to the reader; a search flattens the split, because relevance has
 * already answered the question the grouping was there to answer.
 * @param props - Component props
 * @param props.guides - Every compiled guide's index entry
 * @param props.packageOptions - Every documented package, including those without guides yet
 * @returns The rendered filterable guide list
 */
export function GuidesIndexList({ guides, packageOptions }: GuidesIndexListProps) {
  const searchParams = useSearchParams()
  // why: A fresh filter object per render would defeat the memo below, and the params only change on navigation
  const filter = useMemo(() => readGuideFilter(searchParams), [searchParams])

  const presentTypes = useMemo(() => [...createSet(guides.map((guide) => guide.type))], [guides])
  const visible = useMemo(() => filterGuides(guides, filter), [guides, filter])

  const activePackage = filter.package === GUIDE_FILTER_ALL ? undefined : filter.package

  return (
    <div>
      <GuideFilterBar
        filter={filter}
        packageOptions={packageOptions}
        presentTypes={presentTypes}
        resultCount={visible.length}
        totalCount={guides.length}
      />

      <div className="mt-8">
        {visible.length === 0 ? (
          <EmptyGuides packageName={activePackage} query={filter.query} />
        ) : (
          <>
            {filter.query === '' ? (
              GUIDE_TYPE_GROUPS.map((group) => {
                const inGroup = visible.filter((guide) => guide.type === group.value)
                return inGroup.length > 0 ? (
                  <GuideGroup key={group.value} title={group.heading} description={group.description} guides={inGroup} filter={filter} />
                ) : null
              })
            ) : (
              <GuideGrid guides={visible} filter={filter} />
            )}
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-200 pt-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
              Not what you were looking for?
              <SuggestGuideLink packageName={activePackage} />
            </p>
          </>
        )}
      </div>
    </div>
  )
}

interface EmptyGuidesProps {
  /** npm package the view is narrowed to, when it is narrowed to one */
  packageName?: string
  /** The words the reader searched for, when they searched */
  query: string
}

function EmptyHeading({ packageName, query }: EmptyGuidesProps) {
  if (query) {
    return (
      <>
        Nothing here matches <span className="font-mono text-base">{query}</span>
      </>
    )
  }
  if (packageName) {
    return (
      <>
        There are no guides for <code className="font-mono text-base">{packageName}</code> yet
      </>
    )
  }
  return <>No guides match this view yet</>
}

function EmptyAdvice({ packageName, query }: EmptyGuidesProps) {
  if (query) {
    return <>Try fewer words, or clear the filters and browse the whole corpus.</>
  }
  if (packageName) {
    return <>Guides are written from problems people actually hit. Tell us what you are trying to do and it becomes the next one.</>
  }
  return <>Try a different type or package, or tell us what you were hoping to find.</>
}

function EmptyGuides({ packageName, query }: EmptyGuidesProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        <EmptyHeading packageName={packageName} query={query} />
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        <EmptyAdvice packageName={packageName} query={query} />
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <SuggestGuideLink packageName={packageName} variant="button" label="Request a guide" />
        <Link
          href={buildGuidesHref()}
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-slate-600 hover:underline dark:text-slate-400"
        >
          Browse every guide
        </Link>
      </div>
    </div>
  )
}

interface GuideGridProps {
  /** Guides to lay out */
  guides: GuideIndexEntry[]
  /** The view the cards sit in */
  filter: GuideFilter
}

function GuideGrid({ guides, filter }: GuideGridProps) {
  // why: The docs sidebar claims the content column back at lg, so two columns only fit either side of that breakpoint
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {guides.map((guide) => (
        <GuideCard key={guide.slug} guide={guide} filter={filter} />
      ))}
    </div>
  )
}

interface GuideGroupProps {
  /** Group heading */
  title: string
  /** One-line group description */
  description: string
  /** Guides in this group */
  guides: GuideIndexEntry[]
  /** The view the cards sit in */
  filter: GuideFilter
}

function GuideGroup({ title, description, guides, filter }: GuideGroupProps) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        {title}
        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">{guides.length}</span>
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <div className="mt-4">
        <GuideGrid guides={guides} filter={filter} />
      </div>
    </section>
  )
}
