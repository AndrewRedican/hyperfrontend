import type { TrackedLinkEvent } from '@/components/analytics/tracked-link'
import type { ReactNode } from 'react'
import { TrackedLink } from '@/components/analytics/tracked-link'
import Link from 'next/link'

/**
 * How a pill is coloured. Every tone is a tint of one hue at low alpha over
 * whatever the page is doing behind it, with a border of the same hue and a
 * hover that deepens both, so the whole family reads as one material.
 */
export type PillTone = 'license' | 'stable' | 'prerelease' | 'neutral' | 'muted' | 'accent'

/** Props for {@link MetadataPill}. */
export interface MetadataPillProps {
  /** Where the pill leads; a pill with nowhere to go is drawn as a label */
  href?: string | null
  /** Whether the destination is off-site, and so opens in a new tab */
  external?: boolean
  /** What a screen reader reads instead of the bare value, and what a hover shows */
  label: string
  /** The colour family */
  tone: PillTone
  /** Set the value in the monospace face, for a version or a count */
  mono?: boolean
  /** Analytics event the pill reports when followed */
  event?: TrackedLinkEvent
  /** A mark drawn before the value, sized by the pill */
  icon?: ReactNode
  /** The value the pill shows */
  children: ReactNode
}

/** The colour classes each tone applies on top of the shared geometry. */
const TONE_CLASSES: Record<PillTone, string> = {
  license:
    'border-red-800/25 bg-red-800/[0.07] text-red-800 hover:border-red-800/40 hover:bg-red-800/[0.12] dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300 dark:hover:border-red-400/40 dark:hover:bg-red-400/[0.18]',
  stable:
    'border-primary-500/30 bg-primary-500/10 text-primary-700 hover:border-primary-500/50 hover:bg-primary-500/[0.18] dark:border-primary-400/30 dark:bg-primary-400/10 dark:text-primary-300 dark:hover:border-primary-400/50 dark:hover:bg-primary-400/[0.18]',
  prerelease:
    'border-violet-500/30 bg-violet-500/10 text-violet-700 hover:border-violet-500/50 hover:bg-violet-500/[0.18] dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300 dark:hover:border-violet-400/50 dark:hover:bg-violet-400/[0.18]',
  neutral:
    'border-slate-500/25 bg-slate-500/[0.08] text-slate-700 hover:border-slate-500/45 hover:bg-slate-500/[0.14] dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-300 dark:hover:border-slate-400/45 dark:hover:bg-slate-400/[0.18]',
  muted: 'border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400',
  accent:
    'border-teal-600/30 bg-teal-600/[0.08] text-teal-800 hover:border-teal-600/50 hover:bg-teal-600/[0.14] dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300 dark:hover:border-teal-400/50 dark:hover:bg-teal-400/[0.18]',
}

/**
 * One fact about a package, drawn as a small pill.
 *
 * The geometry lives in the stylesheet under `metadata-pill`, where the
 * height, the padding and the way the text is centred are set once for the
 * whole family; this component only picks a tone and decides whether the
 * pill is a link. A pill is never louder than the title it sits under: it is
 * a metadata line, not a call to action.
 * @param props - See {@link MetadataPillProps}.
 * @param props.href - Where the pill leads
 * @param props.external - Whether the destination is off-site
 * @param props.label - What a screen reader reads
 * @param props.tone - The colour family
 * @param props.mono - Whether the value is set in the monospace face
 * @param props.event - Analytics event reported when followed
 * @param props.icon - A mark drawn before the value
 * @param props.children - The value the pill shows
 * @returns The pill, as a link when it has somewhere to go.
 * @example A version that opens its release on npm
 * ```tsx
 * <MetadataPill href={npmUrl} external label="Version 1.2.0 on npm" tone="stable" mono>
 *   v1.2.0
 * </MetadataPill>
 * ```
 */
export function MetadataPill({ href, external = false, label, tone, mono = false, event, icon, children }: MetadataPillProps) {
  const className = `metadata-pill ${mono ? 'metadata-pill--mono' : ''} ${TONE_CLASSES[tone]}`
  const body = (
    <>
      {icon === undefined ? null : <span className="metadata-pill__mark">{icon}</span>}
      <span className="metadata-pill__label">{children}</span>
    </>
  )

  if (!href) {
    return (
      <span className={className} aria-label={label} title={label}>
        {body}
      </span>
    )
  }

  if (event) {
    return (
      <TrackedLink href={href} event={event} external={external} className={className} ariaLabel={label}>
        {body}
      </TrackedLink>
    )
  }

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label} title={label}>
        {body}
      </a>
    )
  }

  return (
    <Link href={href} className={className} aria-label={label} title={label}>
      {body}
    </Link>
  )
}
