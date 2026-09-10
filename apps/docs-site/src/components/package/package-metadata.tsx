import type { NpmLinkEvent } from '@/components/analytics/tracked-link'
import type { PackageFacts } from '@/lib/package-facts'
import type { ReactNode } from 'react'
import { TrackedLink } from '@/components/analytics/tracked-link'
import { npmVersionUrl } from '@/lib/npm-url'
import { globalIsNaN, parseInt as parseInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

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
  'inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold leading-none tracking-wide transition-colors focus-visible:outline-none'

/**
 * The licence.
 *
 * A solid fill was doing the work of a warning for something that is neither
 * urgent nor a status: the licence is a fact a reader checks once, and it was
 * the loudest thing on a page whose title it sits under. So the colour stays
 * red, because that is what a licence badge looks like everywhere else, and
 * drops to a tint of a darker red instead of a fill of a bright one. It still
 * carries a border and a hover, so it still reads as somewhere to go.
 */
const LICENSE_TONE =
  'border-red-800/25 bg-red-800/[0.07] text-red-800 hover:border-red-800/40 hover:bg-red-800/[0.12] dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300 dark:hover:border-red-400/40 dark:hover:bg-red-400/[0.18]'

/**
 * A released version, at or past its first stable major.
 *
 * Blue because it is the site's own colour, and a package that has committed to
 * a stable surface is the ordinary case rather than a noteworthy one.
 */
const VERSION_STABLE_TONE =
  'border-primary-500/30 bg-primary-500/10 font-mono text-primary-700 hover:border-primary-500/50 hover:bg-primary-500/[0.18] dark:border-primary-400/30 dark:bg-primary-400/10 dark:text-primary-300 dark:hover:border-primary-400/50 dark:hover:bg-primary-400/[0.18]'

/**
 * A version still before its first major.
 *
 * Violet rather than an amber or a red, because this is a category and not a
 * warning: a pre-1.0 package is not broken, it is one whose surface may still
 * move. Violet sits beside the site's blue without being read as a state, and a
 * reader who never learns the distinction loses nothing.
 */
const VERSION_PRERELEASE_TONE =
  'border-violet-500/30 bg-violet-500/10 font-mono text-violet-700 hover:border-violet-500/50 hover:bg-violet-500/[0.18] dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300 dark:hover:border-violet-400/50 dark:hover:bg-violet-400/[0.18]'

/** The badge a package withheld from the registry gets instead of a version. */
const UNPUBLISHED_TONE = 'border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400'

/**
 * Whether a version has reached its first stable major.
 *
 * Read off the major alone, so a prerelease of a stable line still counts as
 * stable and an unparseable version falls to the pre-1.0 side rather than
 * claiming a stability it has not stated.
 * @param version - The version as the package declares it
 * @returns True once the major is 1 or above
 */
function isStableVersion(version: string): boolean {
  const major = parseInteger(version.split('.')[0] ?? '', 10)
  return !globalIsNaN(major) && major >= 1
}

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

  const stable = isStableVersion(facts.version)

  return (
    <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label={`${packageName} package metadata`}>
      {hasLicense && (
        <li>
          <Badge href={licenseHref} label={`License: ${facts.license}`} tone={LICENSE_TONE}>
            <ScalesMark />
            {facts.license}
          </Badge>
        </li>
      )}

      {hasVersion && (
        <li>
          <Badge
            href={npmUrl}
            label={`Version ${facts.version} on npm, ${stable ? 'a stable release' : 'a pre-1.0 release'}`}
            event={{ kind: 'npm', packageName }}
            tone={stable ? VERSION_STABLE_TONE : VERSION_PRERELEASE_TONE}
          >
            v{facts.version}
          </Badge>
        </li>
      )}

      {/* why: a package withheld from the registry has no version worth showing and nowhere to follow one to, so the strip says that rather than printing a placeholder number beside a link that would 404 */}
      {facts.isPrivate && (
        <li>
          <Badge label="Not published to npm" tone={UNPUBLISHED_TONE}>
            Unpublished
          </Badge>
        </li>
      )}
    </ul>
  )
}

/**
 * A pair of scales, drawn beside the licence.
 *
 * Two triangular pans hanging from a beam over a post: the fewest strokes that
 * still read as scales at the size a badge gives them, which is why the pans
 * are not bowls and the beam carries no pivot. It inherits the badge's colour
 * rather than setting its own, so it is correct in both themes and on hover
 * without a second copy of it existing anywhere.
 * @returns The scales mark.
 */
function ScalesMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4.2v14.6" />
      <path d="M8.4 18.8h7.2" />
      <path d="M4.4 7.4h15.2" />
      <path d="M4.4 7.4 1.9 13h5z" />
      <path d="M19.6 7.4 17.1 13h5z" />
    </svg>
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
