import type { GuideFilter } from '@/lib/guide-filters'
import type { GuideIndexEntry } from '@/lib/guides'
import { GuideTypeBadge, VerificationBadge } from '@/components/guides/guide-badges'
import { PackagePill } from '@/components/guides/package-pill'
import { buildGuidesHref } from '@/lib/guide-filters'
import Link from 'next/link'

interface GuideCardProps {
  /** The guide to render */
  guide: GuideIndexEntry
  /** The view the card sits in, so a package pill narrows it rather than replacing it */
  filter: GuideFilter
}

/**
 * One guide, sized to be swept past rather than read: the title leads, the
 * problem it solves follows in at most two lines, and everything a reader
 * only checks after the title has caught them sits in one row at the foot of
 * the card.
 *
 * The title's link covers the card, so anywhere that is not a package pill
 * opens the guide.
 * @param props - Component props
 * @param props.guide - The guide to render
 * @param props.filter - The view the card sits in
 * @returns The rendered guide card
 */
export function GuideCard({ guide, filter }: GuideCardProps) {
  return (
    <article className="group relative flex flex-col rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30">
      <h3 className="font-semibold leading-snug text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        <Link href={guide.route} className="after:absolute after:inset-0 after:content-['']">
          {guide.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-400" title={guide.problem}>
        {guide.problem}
      </p>
      {/* why: relative lifts the row above the title link's card-covering overlay, so a package pill stays clickable on its own */}
      <div className="relative mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        <GuideTypeBadge type={guide.type} />
        {guide.packages.map((packageName) => (
          <PackagePill key={packageName} packageName={packageName} href={buildGuidesHref({ ...filter, package: packageName })} />
        ))}
        <VerificationBadge verification={guide.verification} compact />
        {guide.estMinutes ? <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">~{guide.estMinutes} min</span> : null}
      </div>
    </article>
  )
}
