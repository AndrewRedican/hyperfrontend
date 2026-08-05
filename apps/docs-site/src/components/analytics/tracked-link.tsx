'use client'

import type { DemoOpenMode, DocsCta, RepoLinkLocation } from '@/lib/analytics-events'
import type { ReactNode } from 'react'
import { trackDocsCta, trackNpmVisit, trackRepoVisit } from '@/lib/analytics-events'
import Link from 'next/link'

/** A primary documentation call-to-action activation. */
export interface DocsCtaLinkEvent {
  /** Discriminator. */
  kind: 'docs-cta'
  /** Which call to action the link is. */
  cta: DocsCta
}

/** An outbound visit to the GitHub repository. */
export interface RepoLinkEvent {
  /** Discriminator. */
  kind: 'repo'
  /** Where on the page the link lives. */
  location: RepoLinkLocation
}

/** An outbound visit to a package on npm. */
export interface NpmLinkEvent {
  /** Discriminator. */
  kind: 'npm'
  /** The public npm package name the link targets. */
  packageName: string
}

/** The campaign event a tracked link reports when activated. */
export type TrackedLinkEvent = DocsCtaLinkEvent | RepoLinkEvent | NpmLinkEvent

/** Props for {@link TrackedLink}. */
export interface TrackedLinkProps {
  /** The link target. */
  href: string
  /** The centrally defined campaign event this link reports. */
  event: TrackedLinkEvent
  /** `true` renders an external anchor (new tab, no opener); otherwise a Next link. */
  external?: boolean
  /** Extra classes for the anchor. */
  className?: string
  /** Accessible name override for icon-only links. */
  ariaLabel?: string
  /** The link contents. */
  children: ReactNode
}

/**
 * Dispatches a tracked link's campaign event to the central taxonomy.
 * @param event - The event descriptor carried by the link.
 */
function report(event: TrackedLinkEvent): void {
  if (event.kind === 'docs-cta') {
    trackDocsCta(event.cta)
  } else if (event.kind === 'repo') {
    trackRepoVisit(event.location)
  } else {
    trackNpmVisit(event.packageName)
  }
}

/**
 * A link that reports one centrally defined campaign event when activated.
 * Reporting rides the consent-gated analytics pipeline, so the link behaves
 * identically — and sends nothing — without a configured measurement ID or
 * granted analytics consent.
 * @param props - The {@link TrackedLinkProps}.
 * @param props.href - The link target.
 * @param props.event - The campaign event to report.
 * @param props.external - `true` renders an external anchor.
 * @param props.className - Extra classes for the anchor.
 * @param props.ariaLabel - Accessible name override.
 * @param props.children - The link contents.
 * @returns The anchor element.
 */
export function TrackedLink({ href, event, external = false, className, ariaLabel, children }: TrackedLinkProps) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={ariaLabel} onClick={() => report(event)}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className} aria-label={ariaLabel} onClick={() => report(event)}>
      {children}
    </Link>
  )
}

/** Re-exported so call sites can type their descriptors without a second import path. */
export type { DemoOpenMode, DocsCta, RepoLinkLocation }
