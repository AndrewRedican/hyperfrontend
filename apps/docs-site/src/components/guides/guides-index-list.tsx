'use client'

import type { GuideFilter } from '@/lib/guide-filters'
import type { GuideIndexEntry, GuidePackageOption } from '@/lib/guides'
import { GuideTypeBadge, VerificationBadge } from '@/components/guides/guide-badges'
import { SuggestGuideLink } from '@/components/guides/suggest-guide-link'
import { buildGuidesHref, filterGuides, GUIDE_FILTER_ALL, readGuideFilter } from '@/lib/guide-filters'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * The document types the corpus can hold, in reading order, each with the
 * chip label and the group heading it earns. Tutorials and how-to guides are
 * different promises to the reader, so they never merge into one list.
 */
const TYPE_GROUPS = [
  { value: 'tutorial', chip: 'Tutorials', heading: 'Tutorials', description: 'Learning-oriented: build something real, step by step.' },
  {
    value: 'how-to',
    chip: 'How-to',
    heading: 'How-to guides',
    description: 'Goal-oriented: solve a specific problem with a working result.',
  },
  {
    value: 'troubleshooting',
    chip: 'Troubleshooting',
    heading: 'Troubleshooting',
    description: 'Diagnosis-oriented: work out why HyperFrontend is not behaving as documented.',
  },
  { value: 'recipe', chip: 'Recipes', heading: 'Recipes', description: 'Short, copyable answers to a narrow question.' },
] as const

interface GuidesIndexListProps {
  /** Every compiled guide's index entry */
  guides: GuideIndexEntry[]
  /** Every documented package, including those without guides yet */
  packageOptions: GuidePackageOption[]
}

/**
 * Problem-first guide browser: tutorials, how-to guides, and the rest of the
 * corpus filterable by involved package and document type.
 *
 * Both facets live in the URL rather than in component state, so a narrowed
 * view can be shared, bookmarked, linked from a package README, and walked
 * back through with the browser's own history.
 * @param props - Component props
 * @param props.guides - Every compiled guide's index entry
 * @param props.packageOptions - Every documented package, including those without guides yet
 * @returns The rendered filterable guide list
 */
export function GuidesIndexList({ guides, packageOptions }: GuidesIndexListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { package: packageFilter, type: typeFilter } = readGuideFilter(searchParams)

  const presentTypes = useMemo(() => createSet(guides.map((guide) => guide.type)), [guides])
  const visible = useMemo(() => filterGuides(guides, { package: packageFilter, type: typeFilter }), [guides, packageFilter, typeFilter])

  const activePackage = packageFilter === GUIDE_FILTER_ALL ? undefined : packageFilter

  const applyFilter = (next: Partial<GuideFilter>) => {
    router.push(buildGuidesHref({ package: packageFilter, type: typeFilter, ...next }), { scroll: false })
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter guides by type">
          <FilterChip label="All" active={typeFilter === GUIDE_FILTER_ALL} onClick={() => applyFilter({ type: GUIDE_FILTER_ALL })} />
          {TYPE_GROUPS.filter((group) => presentTypes.has(group.value) || typeFilter === group.value).map((group) => (
            <FilterChip
              key={group.value}
              label={group.chip}
              active={typeFilter === group.value}
              onClick={() => applyFilter({ type: group.value })}
            />
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          Package
          <select
            value={packageFilter}
            onChange={(event) => applyFilter({ package: event.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value={GUIDE_FILTER_ALL}>All packages</option>
            {packageOptions.map((option) => (
              <option key={option.packageName} value={option.packageName}>
                {option.packageName}
                {option.guideCount === 0 ? ' (none yet)' : ` (${option.guideCount})`}
              </option>
            ))}
            {/* why: An unknown package in a shared URL must stay selected, or the control would silently contradict the results below */}
            {activePackage && !packageOptions.some((option) => option.packageName === activePackage) ? (
              <option value={activePackage}>{activePackage}</option>
            ) : null}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyGuides packageName={activePackage} />
      ) : (
        <>
          {TYPE_GROUPS.map((group) => {
            const inGroup = visible.filter((guide) => guide.type === group.value)
            return inGroup.length > 0 ? (
              <GuideGroup key={group.value} title={group.heading} description={group.description} guides={inGroup} />
            ) : null
          })}
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-200 pt-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            Not what you were looking for?
            <SuggestGuideLink packageName={activePackage} />
          </p>
        </>
      )}
    </div>
  )
}

interface EmptyGuidesProps {
  /** npm package the view is narrowed to, when it is narrowed to one */
  packageName?: string
}

function EmptyGuides({ packageName }: EmptyGuidesProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
        {packageName ? (
          <>
            There are no guides for <code className="font-mono text-base">{packageName}</code> yet
          </>
        ) : (
          'No guides match this view yet'
        )}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {packageName
          ? 'Guides are written from problems people actually hit. Tell us what you are trying to do and it becomes the next one.'
          : 'Try a different type or package, or tell us what you were hoping to find.'}
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

interface FilterChipProps {
  /** Chip label */
  label: string
  /** Whether this chip is the active filter */
  active: boolean
  /** Click handler */
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white dark:bg-primary-500'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

interface GuideGroupProps {
  /** Group heading */
  title: string
  /** One-line group description */
  description: string
  /** Guides in this group */
  guides: GuideIndexEntry[]
}

function GuideGroup({ title, description, guides }: GuideGroupProps) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <div className="mt-4 grid gap-4">
        {guides.map((guide) => (
          <GuideCard key={guide.slug} guide={guide} />
        ))}
      </div>
    </section>
  )
}

interface GuideCardProps {
  /** The guide to render */
  guide: GuideIndexEntry
}

function GuideCard({ guide }: GuideCardProps) {
  return (
    <Link
      href={guide.route}
      className="group block rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
    >
      <div className="flex flex-wrap items-center gap-2">
        <GuideTypeBadge type={guide.type} />
        <VerificationBadge verification={guide.verification} />
        {guide.estMinutes ? <span className="text-xs text-slate-500 dark:text-slate-400">~{guide.estMinutes} min</span> : null}
      </div>
      <h3 className="mt-2 font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {guide.title}
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{guide.problem}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {guide.packages.map((packageName) => (
          <code
            key={packageName}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          >
            {packageName}
          </code>
        ))}
      </div>
    </Link>
  )
}
