import { REPO_URL } from '@/lib/site'
import { createURLSearchParams } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

/** Props for {@link ReportAProblem}. */
export interface ReportAProblemProps {
  /**
   * What the reader would be reporting a problem with, in the issue title.
   * Keep it short and specific: it becomes "Docs: <subject>".
   */
  subject: string
  /**
   * Route the report concerns, for example `/docs/quick-start`. It is quoted
   * back in the issue body so a maintainer knows where to look.
   */
  route: string
  /**
   * Extra lines seeded into the issue body, such as the research snapshot a
   * dated page was generated from.
   */
  context?: string[]
  /** Link text. Defaults to `Report a problem`. */
  label?: string
  /** Extra classes for the anchor. */
  className?: string
}

/**
 * Builds a prefilled GitHub issue URL for a documentation problem.
 *
 * The body seeds the coordinates a maintainer needs (route, optional context)
 * and leaves the description to the reader, so a report arrives actionable
 * without forcing anyone through a form.
 * @param props - Subject, route, and any extra context lines.
 * @param props.subject
 * @param props.route
 * @param props.context
 * @returns An absolute URL to GitHub's new-issue form.
 * @example
 * ```ts
 * buildReportUrl({ subject: 'Quick Start', route: '/docs/quick-start' })
 * ```
 */
export function buildReportUrl({ subject, route, context = [] }: Pick<ReportAProblemProps, 'subject' | 'route' | 'context'>): string {
  const body = [
    `**Page:** \`${route}\``,
    ...context.map((line) => `**${line}`),
    '',
    '**What is wrong or out of date?**',
    '',
    '',
    '**What did you expect instead?**',
    '',
  ].join('\n')
  const params = createURLSearchParams({ title: `Docs: ${subject}`, body, labels: 'documentation' })
  return `${REPO_URL}/issues/new?${params.toString()}`
}

/**
 * A link that opens a prefilled GitHub issue about the current page.
 *
 * Documentation goes stale, and a reader who spots it is the cheapest possible
 * detector. This gives them a one-click path that arrives with the page already
 * identified. Reusable from any docs page, guide, or generated report.
 * @param props - See {@link ReportAProblemProps}.
 * @param props.subject
 * @param props.route
 * @param props.context
 * @param props.label
 * @param props.className
 * @returns The report link.
 * @example
 * ```tsx
 * <ReportAProblem subject="Quick Start" route="/docs/quick-start" />
 * ```
 */
export function ReportAProblem({ subject, route, context, label = 'Report a problem', className }: ReportAProblemProps) {
  return (
    <a
      href={buildReportUrl({ subject, route, context })}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100 ${className ?? ''}`}
    >
      <FlagIcon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </a>
  )
}

/** Props for the inline flag icon. */
interface IconProps {
  /** Sizing and color classes. */
  className?: string
}

function FlagIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 4.5h12.5l-2 4 2 4H3" />
    </svg>
  )
}
