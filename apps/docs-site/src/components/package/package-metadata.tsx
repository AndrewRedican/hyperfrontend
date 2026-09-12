import type { PackageFacts } from '@/lib/package-facts'
import { MetadataPill } from '@/components/package/metadata-pill'
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
  /** Route of the package's changelog page, or null for a package without one */
  changelogHref: string | null
}

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
 * pill instead of a heading and a paragraph. Given a full-width section each,
 * they would cost more vertical space than the introduction they push down.
 *
 * Three facts, in a fixed order: the version, because it is the first thing a
 * reader installing the package wants to confirm; the changelog, because it
 * is what that version means; and the licence, which is checked once and
 * read last. Every pill is the same height and sits on the same line, and
 * the row wraps as a row when it must.
 *
 * The version is blue for a stable release and violet before 1.0: a
 * category, not a warning. A package withheld from the registry has no
 * version worth showing and nowhere to follow one to, so the strip says that
 * rather than printing a placeholder beside a link that would 404.
 * @param props - See {@link PackageMetadataProps}.
 * @param props.packageName - Full npm package name
 * @param props.facts - What the package states about itself
 * @param props.licenseHref - Where the package's README points its licence
 * @param props.changelogHref - Route of the package's changelog page
 * @returns The metadata strip, or nothing when the package states no fact at all.
 */
export function PackageMetadata({ packageName, facts, licenseHref, changelogHref }: PackageMetadataProps) {
  const npmUrl = npmVersionUrl(facts, packageName)
  const hasLicense = facts.license !== ''
  const hasVersion = facts.version !== '' && !facts.isPrivate

  if (!hasLicense && !hasVersion && !facts.isPrivate) return null

  const stable = isStableVersion(facts.version)

  return (
    <ul className="metadata-strip mt-3" aria-label={`${packageName} package metadata`}>
      {hasVersion && (
        <li>
          <MetadataPill
            href={npmUrl}
            external
            label={`Version ${facts.version} on npm, ${stable ? 'a stable release' : 'a pre-1.0 release'}`}
            event={{ kind: 'npm', packageName }}
            tone={stable ? 'stable' : 'prerelease'}
            mono
          >
            v{facts.version}
          </MetadataPill>
        </li>
      )}

      {facts.isPrivate && (
        <li>
          <MetadataPill label="Not published to npm" tone="muted">
            Unpublished
          </MetadataPill>
        </li>
      )}

      {changelogHref !== null && (
        <li>
          <MetadataPill
            href={changelogHref}
            label={`${packageName} changelog: every published release and what changed in it`}
            tone="neutral"
            icon={<ChangelogMark />}
          >
            Changelog
          </MetadataPill>
        </li>
      )}

      {hasLicense && (
        <li>
          <MetadataPill href={licenseHref} external label={`License: ${facts.license}`} tone="license" icon={<ScalesMark />}>
            {facts.license}
          </MetadataPill>
        </li>
      )}
    </ul>
  )
}

/**
 * A pair of scales, drawn beside the licence.
 *
 * Two triangular pans hanging from a beam over a post: the fewest strokes that
 * still read as scales at the size a pill gives them. The drawing is centred
 * in its box top to bottom, beam to base, so the pill can centre the box and
 * trust the ink to follow. It inherits the pill's colour rather than setting
 * its own, so it is correct in both themes and on hover.
 * @returns The scales mark.
 */
function ScalesMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4.6v14.8" />
      <path d="M8.4 19.4h7.2" />
      <path d="M4.4 7.8h15.2" />
      <path d="M4.4 7.8 1.9 13.4h5z" />
      <path d="M19.6 7.8 17.1 13.4h5z" />
    </svg>
  )
}

/**
 * A short list with a marker on each line, standing in for a release history.
 * @returns The changelog mark.
 */
function ChangelogMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 6.5h11" />
      <path d="M9 12h11" />
      <path d="M9 17.5h11" />
      <circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
