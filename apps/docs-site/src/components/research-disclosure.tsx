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
  /** Extra classes for the wrapper. */
  className?: string
}

/**
 * States when dated research was last verified, that it can go stale, and how
 * to tell us when it has.
 *
 * Ecosystem comparisons rot. Saying so plainly, next to the date and a report
 * link, is what separates a maintained assessment from an unfalsifiable claim.
 * @param props - See {@link ResearchDisclosureProps}.
 * @param props.reviewed
 * @param props.route
 * @param props.subject
 * @param props.unitCount
 * @param props.attributeCount
 * @param props.className
 * @returns The disclosure block.
 * @example
 * ```tsx
 * <ResearchDisclosure reviewed="August 2026" route="/docs/fit" subject="fit assessment" />
 * ```
 */
export function ResearchDisclosure({ reviewed, route, subject, unitCount, attributeCount, className }: ResearchDisclosureProps) {
  const scope =
    unitCount && attributeCount ? ` Drawn from ${unitCount} researched approaches compared across ${attributeCount} properties.` : ''
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 ${className ?? ''}`}
    >
      <p>
        <span className="font-semibold text-slate-700 dark:text-slate-300">Research last verified {reviewed}.</span> This reflects our best
        factual understanding at that date.{scope} Frontend tooling moves quickly, so specific capabilities, project health, and
        availability may have changed since.
      </p>
      <p className="mt-2">
        <ReportAProblem
          subject={subject}
          route={route}
          context={[`Research snapshot:** ${reviewed}`]}
          label="Something out of date or wrong? Report a problem"
        />
      </p>
    </div>
  )
}
