import type { RelatedEntry } from '@/lib/related-reading'
import { SuggestGuideLink } from '@/components/guides/suggest-guide-link'
import { H2 } from '@/components/heading-with-anchor'
import Link from 'next/link'

/** Props for {@link RelatedReading}. */
export interface RelatedReadingProps {
  /** The anchor id the document index addresses the section by */
  anchor: string
  /** The section heading */
  title: string
  /** Every onward link, nearest first */
  entries: RelatedEntry[]
  /** The package the page documents, for the guide request link */
  packageName: string
  /** The guides index, filtered to this package */
  guidesHref: string
  /** Whether any guide covers the package yet */
  hasGuides: boolean
}

/** Props for {@link RelatedCard}. */
interface RelatedCardProps {
  /** The entry to draw */
  entry: RelatedEntry
}

/**
 * The one place a package page sends a reader next.
 *
 * Every card is drawn the same whether the link came from the guide corpus,
 * from the package's own README, or from this site's two orientation
 * documents, because from the reader's side they are the same kind of thing:
 * somewhere to go after this page. The only distinction the cards draw is the
 * one a reader can act on, which is what sort of document waits on the other
 * side.
 * @param props - See {@link RelatedReadingProps}.
 * @param props.anchor - The anchor id the document index addresses the section by
 * @param props.title - The section heading
 * @param props.entries - Every onward link, nearest first
 * @param props.packageName - The package the page documents
 * @param props.guidesHref - The guides index, filtered to this package
 * @param props.hasGuides - Whether any guide covers the package yet
 * @returns The section.
 */
export function RelatedReading({ anchor, title, entries, packageName, guidesHref, hasGuides }: RelatedReadingProps) {
  return (
    <section className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
      <H2 id={anchor} className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
        {title}
      </H2>

      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {entries.map((entry) => (
          <li key={`${entry.kind}:${entry.href}`} className="flex">
            <RelatedCard entry={entry} />
          </li>
        ))}
      </ul>

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        {hasGuides ? (
          <>
            <Link href={guidesHref} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
              Browse guides filtered to this package
            </Link>
            <SuggestGuideLink packageName={packageName} />
          </>
        ) : (
          <>
            <span>No guides cover {packageName} yet.</span>
            <SuggestGuideLink packageName={packageName} label="Request one" />
          </>
        )}
      </p>
    </section>
  )
}

/**
 * One onward link.
 * @param props - See {@link RelatedCardProps}.
 * @param props.entry - The entry to draw
 * @returns The card.
 */
function RelatedCard({ entry }: RelatedCardProps) {
  return (
    <Link
      href={entry.href}
      className="group w-full rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
    >
      <span className="text-[0.6875rem] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{entry.kind}</span>
      <h3 className="mt-1 break-words font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {entry.title}
      </h3>
      {/* why: a guide states its reader problem in a sentence or three, and a grid of cards is for choosing between destinations rather than reading them; three lines is enough to choose by and keeps the rows even */}
      <p className="mt-1 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{entry.blurb}</p>
    </Link>
  )
}
