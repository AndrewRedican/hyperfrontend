import type { ReactNode } from 'react'
import type { DiscoveryArticle, DiscoveryContent, DiscoveryDemo, DiscoveryGuide, DiscoveryId } from './discovery-model'
import { getDemoTheme } from '@/components/demos/demo-fallback-card'
import { GuideTypeBadge } from '@/components/guides/guide-badges'
import { formatArticleDate } from '@/lib/article-format'
import Link from 'next/link'
import { ArrowGlyph, PlayGlyph } from './discovery-icons'
import { LAUNCH_FILM } from './discovery-model'

/** Props for {@link DiscoveryPanel}. */
interface DiscoveryPanelProps {
  /** Which tile holds the arc's focus */
  focused: DiscoveryId
  /** Everything the panels draw from */
  content: DiscoveryContent
  /** Opens the launch film's player */
  onPlay: () => void
}

/** The card every shelf entry shares: a translucent surface that lights in the staged demo's hue under the pointer, and under the koi. */
const CARD_CLASSES = 'discovery-card group block rounded-xl border p-4 backdrop-blur-xs'

/** The title inside a card, which takes the stage's hue when the card lights. */
const CARD_TITLE_CLASSES = 'discovery-card__title font-semibold'

/**
 * What sits under the arc for the tile in focus: the tutorials for the
 * tutorials tile, the how-to guides for theirs, and likewise for the demos
 * and the articles. The film gets no shelf of invented reading; it gets the
 * one thing it needs, a way to play it.
 * @param props - See {@link DiscoveryPanelProps}.
 * @param props.focused - Which tile holds the arc's focus
 * @param props.content - Everything the panels draw from
 * @param props.onPlay - Opens the launch film's player
 * @returns The panel for the focused tile.
 */
export function DiscoveryPanel({ focused, content, onPlay }: DiscoveryPanelProps) {
  switch (focused) {
    case 'film':
      return <FilmPanel onPlay={onPlay} />
    case 'demos':
      return <DemosPanel live={content.demos.live} planned={content.demos.planned} href={content.demos.href} />
    case 'articles':
      return <ArticlesPanel shelf={content.articles} />
    case 'tutorials':
      return <GuidesPanel onward={`All ${content.tutorials.total} tutorials`} shelf={content.tutorials} />
    case 'how-to':
      return <GuidesPanel onward={`All ${content.howTos.total} how-to guides`} shelf={content.howTos} />
  }
}

/** Props for {@link PanelHeader}. */
interface PanelHeaderProps {
  /** The onward link's text */
  onward: string
  /** Where the onward link goes */
  href: string
}

/**
 * The row above a shelf: the way to all of it. The tile in focus already says
 * what the shelf is, so the row carries no label of its own.
 * @param props - See {@link PanelHeaderProps}.
 * @param props.onward - The onward link's text
 * @param props.href - Where the onward link goes
 * @returns The header row.
 */
function PanelHeader({ onward, href }: PanelHeaderProps) {
  return (
    <div className="flex justify-end">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
      >
        {onward}
        <ArrowGlyph className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

/** Props for {@link GuidesPanel}. */
interface GuidesPanelProps {
  /** The onward link's text */
  onward: string
  /** The guides, and the way to the rest */
  shelf: DiscoveryContent['tutorials']
}

/**
 * A shelf of guides: the type badge and the time it takes, the title, and
 * the problem it starts from.
 * @param props - See {@link GuidesPanelProps}.
 * @param props.onward - The onward link's text
 * @param props.shelf - The guides, and the way to the rest
 * @returns The shelf.
 */
function GuidesPanel({ onward, shelf }: GuidesPanelProps) {
  return (
    <div>
      <PanelHeader onward={onward} href={shelf.href} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {shelf.items.map((guide: DiscoveryGuide) => (
          <Link key={guide.slug} href={guide.route} data-koi-lit className={CARD_CLASSES}>
            <div className="flex flex-wrap items-center gap-2">
              <GuideTypeBadge type={guide.type} />
              {guide.estMinutes ? <span className="text-xs text-slate-500 dark:text-slate-400">~{guide.estMinutes} min</span> : null}
            </div>
            <h4 className={`mt-2 ${CARD_TITLE_CLASSES}`}>{guide.title}</h4>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{guide.problem}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Props for {@link ArticlesPanel}. */
interface ArticlesPanelProps {
  /** The articles, and the way to the rest */
  shelf: DiscoveryContent['articles']
}

/**
 * A shelf of articles: the title, the summary, and when and how long.
 * @param props - See {@link ArticlesPanelProps}.
 * @param props.shelf - The articles, and the way to the rest
 * @returns The shelf.
 */
function ArticlesPanel({ shelf }: ArticlesPanelProps) {
  return (
    <div>
      <PanelHeader onward={`All ${shelf.total} articles`} href={shelf.href} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {shelf.items.map((article: DiscoveryArticle) => (
          <Link key={article.slug} href={`/articles/${article.slug}`} data-koi-lit className={CARD_CLASSES}>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <time dateTime={article.date}>{formatArticleDate(article.date)}</time> · {article.readingTime}
            </p>
            <h4 className={`mt-2 ${CARD_TITLE_CLASSES}`}>{article.title}</h4>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{article.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Props for {@link DemosPanel}. */
interface DemosPanelProps {
  /** The demos running on their own origins */
  live: DiscoveryDemo[]
  /** The demos still in planning */
  planned: DiscoveryDemo[]
  /** Where the gallery is */
  href: string
}

/**
 * A shelf of demos: the live ones as cards in their own accents, and the
 * planned ones as a row of names, so the gallery's whole shape is visible
 * without pretending a plan is a demo.
 * @param props - See {@link DemosPanelProps}.
 * @param props.live - The demos running on their own origins
 * @param props.planned - The demos still in planning
 * @param props.href - Where the gallery is
 * @returns The shelf.
 */
function DemosPanel({ live, planned, href }: DemosPanelProps) {
  return (
    <div>
      <PanelHeader onward="All demos" href={href} />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {live.map((demo) => {
          const theme = getDemoTheme(demo.slug)
          return (
            <Link key={demo.slug} href={href} data-koi-lit className={CARD_CLASSES}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${theme.pill}`}>
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} />
                  Live
                </span>
                <span className="text-slate-500 dark:text-slate-400">{demo.boundary}</span>
              </div>
              <h4 className={`mt-2 ${CARD_TITLE_CLASSES}`}>{demo.title}</h4>
              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{demo.stack}</p>
              <p className="mt-1 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{demo.description}</p>
            </Link>
          )
        })}
      </div>
      {planned.length > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>In planning:</span>
          {planned.map((demo) => (
            <span
              key={demo.slug}
              className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {demo.title}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}

/** Props for {@link FilmPanel}. */
interface FilmPanelProps {
  /** Opens the player */
  onPlay: () => void
}

/**
 * Under the film tile: the film's own poster as a wide frame with the one
 * control that matters on it, and a line saying what the film is. Nothing is
 * invented to fill the shelf; the frame is the film, waiting to be played.
 * @param props - See {@link FilmPanelProps}.
 * @param props.onPlay - Opens the player
 * @returns The frame and its caption.
 */
function FilmPanel({ onPlay }: FilmPanelProps) {
  return (
    <div>
      <div className="flex justify-end">
        <span className="text-sm text-slate-500 dark:text-slate-400">{LAUNCH_FILM.duration} · with sound</span>
      </div>
      <button
        type="button"
        onClick={onPlay}
        aria-label="Play the launch film"
        data-koi-lit
        className="discovery-card discovery-card--film group relative mt-4 block aspect-video w-full overflow-hidden rounded-2xl border text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:aspect-[21/9] lg:aspect-[4/1]"
      >
        <img
          src={LAUNCH_FILM.poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-lit:scale-[1.025]"
          loading="lazy"
          decoding="async"
        />
        <span aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary-700 shadow-xl ring-1 ring-slate-900/10 transition-transform group-lit:scale-105 dark:bg-slate-900/85 dark:text-primary-300 dark:ring-white/15">
            <PlayGlyph className="ml-1 h-7 w-7" />
          </span>
        </span>
        {/* why: on a phone the frame is barely taller than the play mark, so the caption would run straight through it; the header above already says what the film is */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 hidden items-end justify-between gap-4 p-5 text-white sm:flex">
          <span className="max-w-xl text-sm leading-6 text-white/90">
            Seventy-eight seconds on what HyperFrontend is for, made for the Dev Hunt launch. It plays here, over the page.
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-xs backdrop-blur-xs">{LAUNCH_FILM.duration}</span>
        </span>
      </button>
    </div>
  )
}

/** Props for {@link PanelShell}. */
interface PanelShellProps {
  /** What the showing panel is, for the region's name */
  label: string
  /** The panel's content */
  children: ReactNode
}

/**
 * The region the panels render into, named after whichever tile is in focus.
 * @param props - See {@link PanelShellProps}.
 * @param props.label - What the showing panel is
 * @param props.children - The panel's content
 * @returns The region.
 */
export function PanelShell({ label, children }: PanelShellProps) {
  return (
    <div role="region" aria-label={label} className="discovery-panel">
      {children}
    </div>
  )
}
