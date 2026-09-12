import type { MarkdownSection } from '@/lib/slug'
import { TrackedLink } from '@/components/analytics/tracked-link'
import { Breadcrumb } from '@/components/breadcrumb'
import { ChangelogTimeline } from '@/components/changelog/changelog-timeline'
import { RawFileIcon } from '@/components/document/document-icons'
import { DocumentShell } from '@/components/document/document-shell'
import { H1 } from '@/components/heading-with-anchor'
import { packageAccentHue } from '@/components/package/package-accents'
import { PackageIcon } from '@/components/package/package-icon'
import { PageAccent } from '@/components/page-accent'
import { getPackageChangelog } from '@/lib/changelog'
import { releaseAnchor } from '@/lib/changelog-view'
import { npmPackageUrl } from '@/lib/npm-url'
import { REPO_URL } from '@/lib/site'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/** Props for {@link LibraryChangelogPage}. */
export interface LibraryChangelogPageProps {
  /** Route of the package's own page, `/docs/libraries/features` */
  packageRoute: string
  /** Full npm package name */
  packageName: string
}

/** The quiet text rows the actions column is made of, matching the document actions elsewhere. */
const ACTION_CLASSES =
  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'

/**
 * A package's release history, published under its page.
 *
 * Built from the package's own `CHANGELOG.md` at build time and nothing
 * else: the file the release flow writes is the record, and this page is a
 * reading of it. It takes the same shell as every other document here, so
 * the index beside it lists the releases and the actions beside that reach
 * the file itself.
 * @param props - See {@link LibraryChangelogPageProps}.
 * @param props.packageRoute - Route of the package's own page
 * @param props.packageName - Full npm package name
 * @returns The rendered history.
 * @example
 * ```tsx
 * <LibraryChangelogPage packageRoute="/docs/libraries/features" packageName="@hyperfrontend/features" />
 * ```
 */
export async function LibraryChangelogPage({ packageRoute, packageName }: LibraryChangelogPageProps) {
  const changelog = await getPackageChangelog(packageName)
  if (changelog === null) notFound()

  const sections: MarkdownSection[] = changelog.releases.map((release) => ({
    title: `v${release.version}`,
    anchor: releaseAnchor(release.version),
    level: 2,
  }))
  const newest = changelog.releases[0]

  const actions = (
    <div className="flex flex-col gap-0.5">
      <a href={`${REPO_URL}/blob/main/${changelog.sourcePath}`} target="_blank" rel="noopener noreferrer" className={ACTION_CLASSES}>
        <RawFileIcon className="h-4 w-4" />
        View CHANGELOG.md
      </a>
      <TrackedLink href={npmPackageUrl(packageName)} event={{ kind: 'npm', packageName }} external className={ACTION_CLASSES}>
        <NpmIcon className="h-4 w-4" />
        Versions on npm
      </TrackedLink>
    </div>
  )

  return (
    <>
      <PageAccent hue={packageAccentHue(packageName)} />
      <DocumentShell sections={sections} actions={actions}>
        <Breadcrumb />
        <div className="mb-6">
          <Link href={packageRoute} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
            ← Back to {packageName}
          </Link>
        </div>

        <p className="changelog-eyebrow">
          <PackageIcon packageName={packageName} className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <span className="font-mono">{packageName}</span>
        </p>
        <H1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Changelog</H1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
          {changelog.releases.length === 0
            ? 'No release has been recorded yet.'
            : `Every published release, newest first. ${newest === undefined ? '' : `The latest is v${newest.version}.`}`}
        </p>

        <div className="mt-8">
          <ChangelogTimeline packageName={packageName} releases={changelog.releases} />
        </div>
      </DocumentShell>
    </>
  )
}

/** Props for the inline icon. */
interface IconProps {
  /** Sizing and colour classes */
  className?: string
}

/**
 * The npm wordmark's block, reduced to a glyph.
 * @param props - See {@link IconProps}.
 * @param props.className - Sizing and colour classes
 * @returns The icon.
 */
function NpmIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M8 16V8h8v8h-3v-5h-2v5H8z" />
    </svg>
  )
}
