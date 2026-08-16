'use client'

import type { GuideIndexEntry } from '@/lib/guides'
import { GuideTypeBadge, VerificationBadge } from '@/components/guides/guide-badges'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'how-to', label: 'How-to' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'recipe', label: 'Recipes' },
] as const

interface GuidesIndexListProps {
  /** Every compiled guide's index entry */
  guides: GuideIndexEntry[]
}

/**
 * Problem-first guide browser: tutorials and how-to guides grouped and
 * filterable by involved package and document type.
 * @param props - Component props
 * @param props.guides - Every compiled guide's index entry
 * @returns The rendered filterable guide list
 */
export function GuidesIndexList({ guides }: GuidesIndexListProps) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [packageFilter, setPackageFilter] = useState('all')

  const packages = useMemo(() => [...createSet(guides.flatMap((guide) => guide.packages))].sort(), [guides])

  const visible = useMemo(
    () =>
      guides.filter(
        (guide) =>
          (typeFilter === 'all' || guide.type === typeFilter) && (packageFilter === 'all' || guide.packages.includes(packageFilter))
      ),
    [guides, typeFilter, packageFilter]
  )

  const tutorials = visible.filter((guide) => guide.type === 'tutorial')
  const howTos = visible.filter((guide) => guide.type !== 'tutorial')

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter guides by type">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setTypeFilter(filter.value)}
              aria-pressed={typeFilter === filter.value}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === filter.value
                  ? 'bg-primary-600 text-white dark:bg-primary-500'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          Package
          <select
            value={packageFilter}
            onChange={(event) => setPackageFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="all">All packages</option>
            {packages.map((packageName) => (
              <option key={packageName} value={packageName}>
                {packageName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No guides match this filter yet.</p>
      ) : (
        <>
          {tutorials.length > 0 && (
            <GuideGroup title="Tutorials" description="Learning-oriented: build something real, step by step." guides={tutorials} />
          )}
          {howTos.length > 0 && (
            <GuideGroup
              title="How-to guides"
              description="Goal-oriented: solve a specific problem with a working result."
              guides={howTos}
            />
          )}
        </>
      )}
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
