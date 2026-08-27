'use client'

import type { EcosystemCard, EcosystemLevel, EcosystemLibrary, EcosystemEmphasis, EcosystemTier } from '@/lib/ecosystem'
import { Breadcrumb } from '@/components/breadcrumb'
import { H1 } from '@/components/heading-with-anchor'
import { buildEcosystem } from '@/lib/ecosystem'
import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'

/** Props for {@link LibrariesPageContent}. */
interface LibrariesPageContentProps {
  /** Every documented library, read from the generated manifest at build time */
  libraries: EcosystemLibrary[]
}

/** Props for {@link EcosystemLevelSection}. */
interface EcosystemLevelSectionProps {
  /** The level to draw, with the packages placed on it */
  level: EcosystemLevel
}

/** Props for {@link PackageCard}. */
interface PackageCardProps {
  /** The package to draw */
  card: EcosystemCard
  /** How much weight its level carries */
  emphasis: EcosystemEmphasis
}

/** Props for the inline icon components. */
interface IconProps {
  /** Sizing and color classes */
  className?: string
}

/**
 * How many cards sit side by side at each declared width. The single-column
 * form is the floor everywhere, so a narrow viewport reads as one vertical run
 * of full-width cards no matter how wide its level is on a desktop.
 */
const COLUMN_CLASSES = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
} as const

/** The shared card recipe, before the level's own weight is applied. */
const CARD_BASE = 'group relative flex flex-col border transition-colors'

/** The class strings one level applies to its cards. */
interface EmphasisStyle {
  /** The card container */
  card: string
  /** The package heading */
  title: string
  /** The package description */
  description: string
}

/**
 * How a level's weight is drawn. Weight falls with altitude through size and
 * density alone: padding, type scale, and how much of a package the card says
 * out loud. Nothing below the apex changes color, so the descent reads as one
 * surface losing emphasis rather than as five different components.
 */
const EMPHASIS_STYLES: Record<EcosystemEmphasis, EmphasisStyle> = {
  apex: {
    card: `${CARD_BASE} rounded-xl border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6 hover:border-primary-400 dark:border-primary-900 dark:from-primary-950/50 dark:to-slate-900 dark:hover:border-primary-700 sm:p-8`,
    title:
      'font-display text-xl font-bold tracking-tight text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 sm:text-2xl',
    description: 'mt-3 text-base text-slate-600 dark:text-slate-300',
  },
  strong: {
    card: `${CARD_BASE} rounded-lg border-slate-200 bg-white p-5 hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30`,
    title:
      'font-mono text-base font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400',
    description: 'mt-1.5 text-sm text-slate-600 dark:text-slate-400',
  },
  medium: {
    card: `${CARD_BASE} rounded-lg border-slate-200 bg-white p-4 hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30`,
    title: 'font-mono text-sm font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400',
    description: 'mt-1.5 text-sm text-slate-600 dark:text-slate-400',
  },
  soft: {
    card: `${CARD_BASE} rounded-lg border-slate-200 bg-white p-4 hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30`,
    title:
      'font-mono text-sm font-medium text-slate-800 group-hover:text-primary-600 dark:text-slate-200 dark:group-hover:text-primary-400',
    description: 'mt-1.5 line-clamp-3 text-sm text-slate-500 dark:text-slate-400',
  },
}

/**
 * The library index, drawn as the ecosystem rather than as a list.
 *
 * The page is one vertical axis. `@hyperfrontend/features` sits at the top
 * because it is what a visitor came for, and every level below it is a step
 * further from that problem and closer to the machinery. The axis is an axis
 * of abstraction, not a dependency graph: nothing here claims that a package
 * imports the one above it, which is why no connector ever touches an
 * individual card.
 *
 * Search filters the packages and rebuilds the hierarchy from what survives,
 * so a query narrows the map instead of replacing it with a flat list.
 * @param props - Component props
 * @param props.libraries - Every documented library
 * @returns The rendered library index
 */
export function LibrariesPageContent({ libraries }: LibrariesPageContentProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const levels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return buildEcosystem(libraries)

    return buildEcosystem(
      libraries.filter(
        (library) =>
          library.packageName.toLowerCase().includes(query) ||
          library.name.toLowerCase().includes(query) ||
          library.description.toLowerCase().includes(query) ||
          library.keywords.some((keyword) => keyword.toLowerCase().includes(query))
      )
    )
  }, [libraries, searchQuery])

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  return (
    <>
      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Libraries</H1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Every HyperFrontend package, ordered from the SDK you build against down to the primitives underneath.
      </p>

      <div className="relative mt-8">
        <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search packages by name, description, or keyword..."
          aria-label="Search packages"
          className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Clear search"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {levels.length === 0 ? (
        <p className="mt-12 py-12 text-center text-slate-500 dark:text-slate-400">No packages match your search. Try different keywords.</p>
      ) : (
        <div className="relative mt-12">
          {/* why: the axis is drawn once behind everything and interrupted by the opaque cards and level markers, so it reads as a spine threading the levels without ever pointing at a package. */}
          <div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200 dark:bg-slate-800" />
          <div className="relative space-y-12">
            {levels.map((level) => (
              <EcosystemLevelSection key={level.tier.id} level={level} />
            ))}
          </div>
        </div>
      )}

      <section className="mt-16 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generated Documentation</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Full API documentation is generated from TypeScript JSDoc comments using{' '}
          <a
            href="https://typedoc.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline dark:text-primary-400"
          >
            TypeDoc
          </a>
          . Each package includes inline documentation accessible via your IDE&apos;s IntelliSense.
        </p>
        <div className="mt-4">
          <Link
            href="https://github.com/AndrewRedican/hyperfrontend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            View source on GitHub
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}

/**
 * One level of the hierarchy: its marker, then the packages sitting on it.
 *
 * The marker is an opaque bead that breaks the spine, so the axis reads as a
 * sequence of named altitudes. The apex has no bead because nothing runs above
 * it to interrupt; it gets a plain eyebrow instead.
 * @param props - Component props
 * @param props.level - The level to draw
 * @returns The rendered level
 */
function EcosystemLevelSection({ level }: EcosystemLevelSectionProps) {
  const isApex = level.tier.emphasis === 'apex'

  return (
    <section aria-labelledby={levelHeadingId(level.tier)}>
      {isApex ? (
        <h2
          id={levelHeadingId(level.tier)}
          className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400"
        >
          {level.tier.label}
        </h2>
      ) : (
        <div className="mb-6 flex justify-center">
          <h2
            id={levelHeadingId(level.tier)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-center text-xs font-medium tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            {level.tier.label}
          </h2>
        </div>
      )}
      <ul className={`grid gap-4 ${COLUMN_CLASSES[level.tier.columns]}`} role="list">
        {level.cards.map((card) => (
          <li key={card.packageName} className="flex">
            <PackageCard card={card} emphasis={level.tier.emphasis} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Compute the heading id a level's section is labelled by.
 * @param tier - The level being drawn
 * @returns A stable, server-rendered id
 */
function levelHeadingId(tier: EcosystemTier): string {
  return `ecosystem-${tier.id}`
}

/**
 * One package. The heading's link covers the card, so anywhere on it opens the
 * package, and the card stays a single tab stop with one destination.
 * @param props - Component props
 * @param props.card - The package to draw
 * @param props.emphasis - How much weight its level carries
 * @returns The rendered card
 */
function PackageCard({ card, emphasis }: PackageCardProps) {
  const style = EMPHASIS_STYLES[emphasis]
  const isApex = emphasis === 'apex'

  return (
    <article className={`${style.card} w-full`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={style.title}>
            <Link href={card.href} className="after:absolute after:inset-0 after:content-['']">
              {isApex ? card.name : card.packageName}
            </Link>
          </h3>
          {isApex && <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{card.packageName}</p>}
        </div>
        <ArrowRightIcon
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary-500 ${isApex ? 'mt-1' : ''}`}
        />
      </div>

      {card.description && <p className={style.description}>{card.description}</p>}

      {/* why: relative lifts this row above the heading link's card-covering overlay, so the pills are readable text rather than a shadowed strip. */}
      <div className="relative mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {card.topics.map((topic) => (
          <span key={topic} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {topic}
          </span>
        ))}
        {card.version && !card.isPrivate && (
          <span className="ml-auto font-mono text-xs text-slate-400 dark:text-slate-500">v{card.version}</span>
        )}
      </div>
    </article>
  )
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  )
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
