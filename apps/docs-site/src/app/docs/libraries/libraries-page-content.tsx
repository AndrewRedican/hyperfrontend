'use client'

import type { EcosystemCard, EcosystemLevel, EcosystemLibrary, EcosystemEmphasis, EcosystemTier } from '@/lib/ecosystem'
import type { SpineSegment } from '@/lib/ecosystem-spine'
import { TrackedLink } from '@/components/analytics/tracked-link'
import { Breadcrumb } from '@/components/breadcrumb'
import { H1 } from '@/components/heading-with-anchor'
import { PackageIcon } from '@/components/package/package-icon'
import { buildEcosystem } from '@/lib/ecosystem'
import { computeSpine } from '@/lib/ecosystem-spine'
import Link from 'next/link'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

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

/** Props for {@link CardVersion}. */
interface CardVersionProps {
  /** The package the version belongs to */
  card: EcosystemCard
  /** Positioning and colour for the corner it sits in */
  className: string
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

/** Attribute the spine finds the cards by, whatever level they sit on. */
const CARD_ATTRIBUTE = 'data-ecosystem-card'

/**
 * The shared card recipe, before the level's own weight is applied. The
 * surface itself is `package-card` in the stylesheet, where its glass lives
 * beside the code block's.
 */
const CARD_BASE = 'group package-card flex flex-col overflow-hidden'

/**
 * How a package's mark is drawn behind its card.
 *
 * The mark is identity, not information: it sits against the right edge at a
 * quarter opacity, in the same slate the rest of the card's chrome uses, so it
 * reads as a watermark the eye can learn rather than as something to look at.
 *
 * Being ambient is also why it reserves no room. A background does not get a
 * column: the arrow and the version are pinned to the card's own corners and
 * paint over the mark, and only the card's running text is held clear of it,
 * by a gutter carried on the text blocks themselves rather than on the card.
 * The distinction matters at the right edge, which is where a reader looks for
 * both of those controls, and where a mark that pushed them inward would leave
 * a band of nothing.
 *
 * It brightens slightly on hover, the same way the card's border and title do,
 * so the identity is at its clearest exactly when a reader has singled the
 * package out.
 */
const CARD_MARK =
  'pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 opacity-25 transition-opacity duration-300 group-hover:opacity-40 dark:text-slate-500'

/**
 * The arrow, pinned to the card's top-right corner.
 *
 * Positioned against the card rather than laid out beside the title, so it
 * lands on the same corner whatever the title does: a package name that wraps
 * to two lines no longer drags it down the card with it. It is a cue for the
 * direction the whole card goes in, not a control of its own.
 */
const CARD_ARROW =
  'pointer-events-none absolute h-5 w-5 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary-500 dark:text-slate-500'

/**
 * The version, pinned to the card's bottom-right corner.
 *
 * It is a link to exactly this release on npm, so it is stacked above the
 * heading's card-covering overlay and keeps its own pointer events. That makes
 * the one part of the card that does not open the package the one part that
 * says where else it could go.
 */
const CARD_VERSION =
  'package-card__version absolute font-mono text-xs text-slate-400 transition-colors hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400'

/** The class strings one level applies to its cards. */
interface EmphasisStyle {
  /** The card container */
  card: string
  /** The package heading */
  title: string
  /** The package description */
  description: string
  /** Size and inset of the package mark behind the card */
  mark: string
  /** Right gutter that holds the card's running text clear of the mark */
  gutter: string
  /** Right gutter on the bottom row, which clears the version rather than the mark */
  bottomGutter: string
  /** Where the arrow sits, relative to the card's top-right corner */
  arrowAt: string
  /** Where the version sits, relative to the card's bottom-right corner */
  versionAt: string
}

/**
 * How a level's weight is drawn. Weight falls with altitude through size and
 * density alone: padding, type scale, and how much of a package the card says
 * out loud. Nothing below the apex changes surface, so the descent reads as
 * one material losing emphasis rather than as five different components.
 */
const EMPHASIS_STYLES: Record<EcosystemEmphasis, EmphasisStyle> = {
  apex: {
    card: `${CARD_BASE} package-card--apex rounded-xl p-6 sm:p-8`,
    title:
      'font-display text-xl font-bold tracking-tight text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 sm:text-2xl',
    description: 'mt-3 text-base text-slate-600 dark:text-slate-300',
    mark: 'right-0 h-16 w-16 sm:h-36 sm:w-36',
    gutter: 'pr-10 sm:pr-40',
    bottomGutter: 'pr-16 sm:pr-40',
    arrowAt: 'right-6 top-6 sm:right-8 sm:top-8',
    versionAt: 'right-6 bottom-6 sm:right-8 sm:bottom-8',
  },
  strong: {
    card: `${CARD_BASE} rounded-lg p-5`,
    title:
      'font-mono text-base font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400',
    description: 'mt-1.5 text-sm text-slate-600 dark:text-slate-400',
    mark: 'right-0 h-16 w-16',
    gutter: 'pr-16',
    bottomGutter: 'pr-16',
    arrowAt: 'right-5 top-5',
    versionAt: 'right-5 bottom-5',
  },
  medium: {
    card: `${CARD_BASE} rounded-lg p-4`,
    title: 'font-mono text-sm font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400',
    description: 'mt-1.5 text-sm text-slate-600 dark:text-slate-400',
    mark: 'right-0 h-14 w-14',
    gutter: 'pr-14',
    bottomGutter: 'pr-16',
    arrowAt: 'right-4 top-4',
    versionAt: 'right-4 bottom-4',
  },
  soft: {
    card: `${CARD_BASE} rounded-lg p-4`,
    title:
      'font-mono text-sm font-medium text-slate-800 group-hover:text-primary-600 dark:text-slate-200 dark:group-hover:text-primary-400',
    description: 'mt-1.5 line-clamp-3 text-sm text-slate-500 dark:text-slate-400',
    mark: 'right-0 h-12 w-12',
    gutter: 'pr-12',
    bottomGutter: 'pr-16',
    arrowAt: 'right-4 top-4',
    versionAt: 'right-4 bottom-4',
  },
}

/**
 * The library index, drawn as the ecosystem rather than as a list.
 *
 * The page is one vertical axis. `@hyperfrontend/features` sits at the top
 * because it is what a visitor came for, and every level below it is a step
 * further from that problem and closer to the machinery. The axis is an axis
 * of abstraction, not a dependency graph: nothing here claims that a package
 * imports the one above it, which is why the spine is drawn from the
 * flagship's lower edge to the last card in its path and never into one.
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
        <EcosystemMap levels={levels} />
      )}
    </>
  )
}

/** Props for {@link EcosystemMap}. */
interface EcosystemMapProps {
  /** The levels with something on them, top to bottom */
  levels: EcosystemLevel[]
}

/**
 * The levels and the spine that threads them.
 *
 * The spine is measured rather than declared. Where it starts and stops
 * depends on which card the axis meets last, and that depends on how many
 * columns each level has at this width, how many packages are on it, and
 * whether a search has thinned it: three things the layout knows and the
 * markup does not. So the map reads its own cards after layout, hands their
 * boxes to {@link computeSpine}, and draws the one segment it gets back. It
 * re-reads whenever the map changes size, which is every case in which the
 * answer could have changed, and it re-reads before paint so a reader never
 * sees a spine that was right for a layout that is no longer there.
 * @param props - See {@link EcosystemMapProps}.
 * @param props.levels - The levels to draw
 * @returns The rendered map
 */
function EcosystemMap({ levels }: EcosystemMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [spine, setSpine] = useState<SpineSegment | null>(null)

  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return undefined

    const measure = (): void => {
      const frame = map.getBoundingClientRect()
      const cards = [...map.querySelectorAll<HTMLElement>(`[${CARD_ATTRIBUTE}]`)].map((card) => {
        const box = card.getBoundingClientRect()
        return { top: box.top - frame.top, bottom: box.bottom - frame.top, left: box.left - frame.left, right: box.right - frame.left }
      })
      const next = computeSpine(cards, frame.width / 2)
      // why: a resize that leaves the cards where they were must not re-render the map for nothing
      setSpine((current) => (current?.top === next?.top && current?.height === next?.height ? current : next))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(map)
    return () => observer.disconnect()
  }, [levels])

  return (
    <div ref={mapRef} className="relative mt-12">
      {/* why: the spine is drawn once behind everything, and its run is the measured distance from the flagship's lower edge to the last card on its path, so it reads as connecting cards rather than spanning a grid */}
      {spine && (
        <div
          aria-hidden="true"
          className="absolute left-1/2 w-px -translate-x-1/2 bg-slate-200 dark:bg-slate-800"
          style={{ top: spine.top, height: spine.height }}
        />
      )}
      <div className="relative space-y-12">
        {levels.map((level) => (
          <EcosystemLevelSection key={level.tier.id} level={level} />
        ))}
      </div>
    </div>
  )
}

/**
 * One level of the hierarchy: its marker, then the packages sitting on it.
 *
 * The marker is an opaque bead that breaks the spine, so the axis reads as a
 * sequence of named altitudes. The apex has no bead because nothing runs above
 * it to interrupt; it gets a plain eyebrow instead, and the spine begins below
 * its card rather than above its label.
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
 * One package.
 *
 * The whole card opens the package, and it does so through one real link: the
 * heading's, whose overlay the stylesheet stretches across the card. So the
 * card is a single tab stop with a single destination, a middle click or a
 * modifier click on any part of it opens the package in a new tab the way the
 * browser does for any link, and focus is drawn around the card rather than
 * around two words of title. The version in the corner is the one exception,
 * a second link stacked above the overlay, because it goes somewhere else.
 * Two links, never one inside the other.
 * @param props - Component props
 * @param props.card - The package to draw
 * @param props.emphasis - How much weight its level carries
 * @returns The rendered card
 */
function PackageCard({ card, emphasis }: PackageCardProps) {
  const style = EMPHASIS_STYLES[emphasis]
  const isApex = emphasis === 'apex'

  return (
    <article className={`${style.card} w-full`} {...{ [CARD_ATTRIBUTE]: '' }}>
      {/* why: first in the DOM and unpositioned content after it, so the mark paints behind every line of the card without a z-index to keep in step with the rest of the site's layering */}
      <PackageIcon packageName={card.packageName} className={`${CARD_MARK} ${style.mark}`} />

      <div className={`min-w-0 ${style.gutter}`}>
        <h3 className={style.title}>
          <Link href={card.href} className="package-card__link">
            {isApex ? card.name : card.packageName}
          </Link>
        </h3>
        {isApex && <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{card.packageName}</p>}
      </div>

      {card.description && <p className={`${style.gutter} ${style.description}`}>{card.description}</p>}

      <div className={`mt-auto flex flex-wrap items-center gap-1.5 pt-3 ${style.bottomGutter}`}>
        {card.topics.map((topic) => (
          <span key={topic} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {topic}
          </span>
        ))}
      </div>

      <ArrowRightIcon className={`${CARD_ARROW} ${style.arrowAt}`} />
      <CardVersion card={card} className={`${CARD_VERSION} ${style.versionAt}`} />
    </article>
  )
}

/**
 * The version in a card's bottom-right corner.
 *
 * A published package gets a link to exactly this release on npm, built by the
 * same function the package pages use, so the two surfaces can never disagree
 * about where a version leads. A package withheld from the registry has no
 * version worth showing and nowhere to send anyone, so the corner stays empty
 * rather than carrying a number beside a link that would not resolve.
 * @param props - Component props
 * @param props.card - The package the version belongs to
 * @param props.className - Positioning and colour for the corner
 * @returns The version, linked when there is a release to link to
 */
function CardVersion({ card, className }: CardVersionProps) {
  if (!card.version || card.isPrivate) {
    return null
  }
  const label = `v${card.version}`
  if (card.npmUrl === null) {
    return <span className={className}>{label}</span>
  }
  return (
    <TrackedLink
      href={card.npmUrl}
      event={{ kind: 'npm', packageName: card.packageName }}
      external
      className={className}
      ariaLabel={`${card.packageName} ${label} on npm`}
    >
      {label}
    </TrackedLink>
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
