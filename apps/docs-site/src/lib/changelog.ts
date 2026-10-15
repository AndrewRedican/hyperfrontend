import type { ChangelogItem, ChangelogRelease, ChangelogSection } from './changelog-parse'
import type { LibraryInfo } from './content'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseChangelog } from './changelog-parse'
import { LIBRARIES } from './content'
import { markdownToInlineHtml } from './markdown'

const WORKSPACE_ROOT = resolve(process.cwd(), '../..')

/** A note with its markdown rendered, ready to draw. */
export interface RenderedChangelogItem extends ChangelogItem {
  /** The note as inline HTML */
  html: string
}

/** A section whose notes are rendered. */
export interface RenderedChangelogSection extends Omit<ChangelogSection, 'items'> {
  /** The notes, rendered */
  items: RenderedChangelogItem[]
}

/** A release whose notes are rendered. */
export interface RenderedChangelogRelease extends Omit<ChangelogRelease, 'sections'> {
  /** The sections, rendered */
  sections: RenderedChangelogSection[]
}

/** Everything a package's changelog page draws from. */
export interface PackageChangelog {
  /** Full npm package name */
  packageName: string
  /** The releases, newest first */
  releases: RenderedChangelogRelease[]
  /** Workspace-relative path of the file the page was built from, for linking to its source */
  sourcePath: string
}

/**
 * Where a documented package keeps its changelog.
 *
 * The changelog sits beside the README the library list already names, so
 * the list stays the one place a package's files are located from.
 *
 * @param packageName - Full npm package name
 * @returns Workspace-relative path, or null for a package the site does not document
 */
export function changelogPathFor(packageName: string): string | null {
  const library = LIBRARIES.find((entry) => entry.packageName === packageName)
  return library === undefined ? null : join(dirname(library.readmePath), 'CHANGELOG.md')
}

/** The segment a package's changelog page sits at under the package's own route. */
export const CHANGELOG_SEGMENT = 'releases'

/**
 * The route of a package's changelog page.
 *
 * Under the package's route as `releases` rather than `changelog`, because
 * `changelog` is already an entry point of `@hyperfrontend/versioning` and
 * has that package's submodule page at `/docs/libraries/versioning/changelog`.
 * One segment for every package keeps the pages one family.
 *
 * @param packageRoute - The package's own route, `/docs/libraries/features`
 * @returns The changelog page's route, without a trailing slash
 *
 * @example
 * ```typescript
 * changelogRouteFor('/docs/libraries/features') // '/docs/libraries/features/releases'
 * ```
 */
export function changelogRouteFor(packageRoute: string): string {
  return `${packageRoute}/${CHANGELOG_SEGMENT}`
}

/**
 * Whether a documented package has a changelog on disk.
 *
 * The versioning flow writes the file with the package's first release, so
 * its presence is what tells the site the package has been released at all.
 *
 * @param library - The documented package
 * @returns True when the changelog sits beside the package's README
 */
function hasChangelog(library: LibraryInfo): boolean {
  return existsSync(join(WORKSPACE_ROOT, dirname(library.readmePath), 'CHANGELOG.md'))
}

/**
 * The route of every package changelog page the site publishes.
 *
 * One per documented package whose changelog exists on disk, which is every
 * published package: an unpublished one has no releases and no file.
 *
 * @returns Site-relative routes without a trailing slash
 *
 * @example
 * ```typescript
 * getChangelogRoutes() // ['/docs/libraries/nexus/releases', ...]
 * ```
 */
export function getChangelogRoutes(): string[] {
  return LIBRARIES.filter((library) => hasChangelog(library)).map((library) => changelogRouteFor(`/docs/libraries/${library.slug}`))
}

/**
 * The route of every package changelog page still waiting for a first release.
 *
 * A package is documented before it is published and its releases page is
 * routed with the rest of its pages, but the page answers not found until the
 * versioning flow writes the changelog. The sitemap leaves these routes out
 * on purpose, and the sitemap check reads them here so it can do the same.
 *
 * @returns Site-relative routes without a trailing slash
 *
 * @example
 * ```typescript
 * getPendingChangelogRoutes() // ['/docs/libraries/testing/releases']
 * ```
 */
export function getPendingChangelogRoutes(): string[] {
  return LIBRARIES.filter((library) => !hasChangelog(library)).map((library) => changelogRouteFor(`/docs/libraries/${library.slug}`))
}

/**
 * Read and render a package's changelog.
 *
 * The file is the source of truth: it is parsed at build time, every note's
 * markdown is rendered inline, and nothing about it is stored anywhere else.
 * A package without a changelog, which is what an unpublished package has,
 * gets null rather than an empty history, so its page can say so.
 *
 * @param packageName - Full npm package name
 * @returns The rendered history, or null when the package has no changelog
 *
 * @example
 * ```typescript
 * const changelog = await getPackageChangelog('@hyperfrontend/features')
 * changelog?.releases[0].version // '0.10.0'
 * ```
 */
export async function getPackageChangelog(packageName: string): Promise<PackageChangelog | null> {
  const sourcePath = changelogPathFor(packageName)
  if (sourcePath === null) return null
  const absolute = join(WORKSPACE_ROOT, sourcePath)
  if (!existsSync(absolute)) return null

  const releases: RenderedChangelogRelease[] = []
  for (const release of parseChangelog(readFileSync(absolute, 'utf8'))) {
    const sections: RenderedChangelogSection[] = []
    for (const section of release.sections) {
      const items: RenderedChangelogItem[] = []
      for (const item of section.items) {
        items.push({ ...item, html: await markdownToInlineHtml(item.text) })
      }
      sections.push({ ...section, items })
    }
    releases.push({ ...release, sections })
  }
  return { packageName, releases, sourcePath }
}
