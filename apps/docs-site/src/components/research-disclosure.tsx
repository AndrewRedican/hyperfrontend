import { ReportAProblem } from '@/components/report-a-problem'

/** Props for {@link ResearchDisclosure}. */
export interface ResearchDisclosureProps {
  /** Human-readable date the underlying research was last verified, for example `August 2026`. */
  reviewed: string
  /** Route the disclosure sits on, passed through to the report link. */
  route: string
  /** Subject for the report link's issue title. */
  subject: string
  /** How many approaches the finding set covers, when the page is dataset-backed. */
  unitCount?: number
  /** How many properties each approach was compared against. */
  attributeCount?: number
  /** Render as a one-line control that opens on click, instead of an always-open block. */
  collapsible?: boolean
  /** Extra classes for the wrapper. */
  className?: string
}

/**
 * States when dated research was last verified, that it can go stale, and how
 * to tell us when it has.
 *
 * Ecosystem comparisons rot. Saying so plainly, next to the date and a report
 * link, is what separates a maintained assessment from an unfalsifiable claim.
 * Where the disclosure would compete with the page's actual work, `collapsible`
 * keeps the same words one click away rather than dropping them.
 * @param props - See {@link ResearchDisclosureProps}.
 * @param props.reviewed
 * @param props.route
 * @param props.subject
 * @param props.unitCount
 * @param props.attributeCount
 * @param props.collapsible
 * @param props.className
 * @returns The disclosure block.
 * @example
 * ```tsx
 * <ResearchDisclosure reviewed="August 2026" route="/docs/fit" subject="fit assessment" collapsible />
 * ```
 */
export function ResearchDisclosure({
  reviewed,
  route,
  subject,
  unitCount,
  attributeCount,
  collapsible,
  className,
}: ResearchDisclosureProps) {
  const scope =
    unitCount && attributeCount ? ` Drawn from ${unitCount} researched approaches compared across ${attributeCount} properties.` : ''
  const body = (
    <>
      <span className="font-semibold text-slate-700 dark:text-slate-300">Research last verified {reviewed}.</span> This reflects our best
      factual understanding at that date.{scope} Frontend tooling moves quickly, so specific capabilities, project health, and availability
      may have changed since.
    </>
  )
  const report = <ReportAProblem subject={subject} route={route} context={[`Research snapshot:** ${reviewed}`]} />

  if (collapsible) {
    return (
      <div className={`flex flex-wrap items-start gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400 ${className ?? ''}`}>
        {/* why: a details element keeps the words one click away with no client JavaScript, on a page that is otherwise static */}
        <details className="group min-w-0 flex-1">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white [&::-webkit-details-marker]:hidden">
            <InfoIcon className="h-3.5 w-3.5 shrink-0" />
            How this was researched
            <ChevronIcon className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <p className="mt-2 max-w-2xl leading-relaxed">{body}</p>
        </details>
        <span className="shrink-0">{report}</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 ${className ?? ''}`}
    >
      <p>{body}</p>
      <p className="mt-2">{report}</p>
    </div>
  )
}

/** Props for the inline disclosure icons. */
interface IconProps {
  /** Sizing and color classes. */
  className?: string
}

function InfoIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v5.5M12 7.75h.01" />
    </svg>
  )
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
