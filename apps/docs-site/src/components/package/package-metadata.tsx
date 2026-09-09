import type { NpmLinkEvent } from '@/components/analytics/tracked-link'
import type { PackageFacts } from '@/lib/package-facts'
import type { ReactNode } from 'react'
import { TrackedLink } from '@/components/analytics/tracked-link'
import { npmVersionUrl } from '@/lib/package-facts'

/** Props for {@link PackageMetadata}. */
export interface PackageMetadataProps {
  /** Full npm package name */
  packageName: string
  /** What the package states about itself */
  facts: PackageFacts
  /** Where the package's own README points its licence, when it points anywhere */
  licenseHref: string | null
}

/** Props for {@link Badge}. */
interface BadgeProps {
  /** Where the badge leads, or nothing when it leads nowhere */
  href?: string | null
  /** What a screen reader reads instead of the bare value */
  label: string
  /** Colour and type classes for the pill */
  tone: string
  /** Analytics event this badge reports when followed */
  event?: NpmLinkEvent
  /** The value the badge shows */
  children: ReactNode
}

/** The geometry every badge in the strip shares. */
const BADGE_BASE =
  'inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold leading-none tracking-wide transition-colors focus-visible:outline-none'

/**
 * The strip of package facts that sits directly under a package's title.
 *
 * It is a metadata line, not a section: everything on it is one short value
 * about the package rather than something to read, which is why each fact is a
 * badge instead of a heading and a paragraph. A licence is four characters and
 * a link; a version is a number and a link. Given a full-width section each,
 * they cost more vertical space than the introduction they push down.
 *
 * The strip exists so package-level facts have somewhere to live. Two are here
 * today. A third belongs here only once it is genuinely useful to a reader
 * standing at the top of the page, and it must stay subordinate to the title
 * and the introduction: this row never grows louder than what it describes.
 * @param props - See {@link PackageMetadataProps}.
 * @param props.packageName - Full npm package name
 * @param props.facts - What the package states about itself
 * @param props.licenseHref - Where the package's README points its licence
 * @returns The metadata strip, or nothing when the package states neither fact.
 */
export function PackageMetadata({ packageName, facts, licenseHref }: PackageMetadataProps) {
  const npmUrl = npmVersionUrl(facts, packageName)
  const hasLicense = facts.license !== ''
  const hasVersion = facts.version !== '' && !facts.isPrivate

  if (!hasLicense && !hasVersion && !facts.isPrivate) return null

  return (
    <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label={`${packageName} package metadata`}>
      {hasLicense && (
        <li>
          <Badge href={licenseHref} label={`License: ${facts.license}`} tone="bg-red-600 text-white hover:bg-red-700">
            {facts.license}
          </Badge>
        </li>
      )}

      {hasVersion && (
        <li>
          <Badge
            href={npmUrl}
            label={`Version ${facts.version} on npm`}
            event={{ kind: 'npm', packageName }}
            tone="border border-slate-200 bg-slate-100 font-mono text-slate-700 hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:text-primary-300"
          >
            v{facts.version}
          </Badge>
        </li>
      )}

      {/* why: a package withheld from the registry has no version worth showing and nowhere to follow one to, so the strip says that rather than printing a placeholder number beside a link that would 404 */}
      {facts.isPrivate && (
        <li>
          <Badge
            label="Not published to npm"
            tone="border border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400"
          >
            Unpublished
          </Badge>
        </li>
      )}
    </ul>
  )
}

/**
 * One pill in the strip, linked when the fact it carries has a destination.
 * @param props - See {@link BadgeProps}.
 * @param props.href - Where the badge leads
 * @param props.label - What a screen reader reads
 * @param props.tone - Colour and type classes
 * @param props.event - Analytics event reported when followed
 * @param props.children - The value the badge shows
 * @returns The badge.
 */
function Badge({ href, label, tone, event, children }: BadgeProps) {
  const className = `${BADGE_BASE} ${tone}`

  if (!href) {
    return (
      <span className={className} aria-label={label} title={label}>
        {children}
      </span>
    )
  }

  if (event) {
    return (
      <TrackedLink href={href} event={event} external className={className} ariaLabel={label}>
        {children}
      </TrackedLink>
    )
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label} title={label}>
      {children}
    </a>
  )
}
