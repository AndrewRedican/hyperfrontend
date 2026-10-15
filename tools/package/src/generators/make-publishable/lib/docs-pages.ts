import type { LibraryFacts } from './library-facts'
import { posix } from 'node:path'
import { names } from '@nx/devkit'

/** The app-router directory every library page lives under. */
const PAGES_ROOT = 'apps/docs-site/src/app/docs/libraries'

/**
 * One page the docs site needs for a library.
 */
export interface DocsPageFile {
  /** Workspace-relative path of the page module */
  path: string
  /** The module's source */
  content: string
}

/**
 * A value written into a JSX string attribute.
 *
 * @param value - The text
 * @returns The text with the quote the attribute is delimited by escaped
 */
function attribute(value: string): string {
  return value.replaceAll('"', '&quot;')
}

/**
 * The page that renders a library's README and API reference.
 *
 * @param facts - What was derived from the package's project
 * @returns The page module's source
 *
 * @example
 * ```typescript
 * renderLibraryPage(facts) // "import type { Metadata } from 'next'\n..."
 * ```
 */
export function renderLibraryPage(facts: LibraryFacts): string {
  return [
    "import type { Metadata } from 'next'",
    "import { LibraryDocPage } from '@/components/library-doc-page'",
    "import { getLibraryMetadata } from '@/lib/metadata'",
    '',
    'export function generateMetadata(): Metadata {',
    `  return getLibraryMetadata('${facts.manifestSlug}')`,
    '}',
    '',
    `export default function ${names(facts.libName).className}Page() {`,
    '  return (',
    '    <LibraryDocPage',
    `      title="${attribute(facts.displayName)}"`,
    `      packageName="${facts.packageName}"`,
    `      slug="${facts.pageSlug}"`,
    `      category="${facts.docsCategory}"`,
    `      fallbackDescription="${attribute(facts.description)}"`,
    '    />',
    '  )',
    '}',
    '',
  ].join('\n')
}

/**
 * The page that renders a library's release history.
 *
 * @param facts - What was derived from the package's project
 * @returns The page module's source
 *
 * @example
 * ```typescript
 * renderReleasesPage(facts) // "import type { Metadata } from 'next'\n..."
 * ```
 */
export function renderReleasesPage(facts: LibraryFacts): string {
  return [
    "import type { Metadata } from 'next'",
    "import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'",
    "import { getChangelogMetadata } from '@/lib/metadata'",
    '',
    'export function generateMetadata(): Metadata {',
    `  return getChangelogMetadata('${facts.manifestSlug}')`,
    '}',
    '',
    `export default function ${names(facts.libName).className}ReleasesPage() {`,
    `  return <LibraryChangelogPage packageRoute="/docs/libraries/${facts.routeSlug}" packageName="${facts.packageName}" />`,
    '}',
    '',
  ].join('\n')
}

/**
 * The page that renders a library's architecture document.
 *
 * @param facts - What was derived from the package's project
 * @returns The page module's source
 *
 * @example
 * ```typescript
 * renderArchitecturePage(facts) // "import type { Metadata } from 'next'\n..."
 * ```
 */
export function renderArchitecturePage(facts: LibraryFacts): string {
  return [
    "import type { Metadata } from 'next'",
    "import { LibraryArchitecturePage } from '@/components/library-architecture-page'",
    "import { getArchitectureMetadata } from '@/lib/metadata'",
    '',
    'export function generateMetadata(): Metadata {',
    `  return getArchitectureMetadata('${facts.manifestSlug}')`,
    '}',
    '',
    `export default function ${names(facts.libName).className}ArchitecturePage() {`,
    `  return <LibraryArchitecturePage slug="${facts.routeSlug}" packageName="${facts.packageName}" />`,
    '}',
    '',
  ].join('\n')
}

/**
 * The page that renders one secondary entry of a library.
 *
 * @param facts - What was derived from the package's project
 * @param subpath - The entry's subpath, `commits/parse`
 * @returns The page module's source
 *
 * @example
 * ```typescript
 * renderSubmodulePage(facts, 'runner') // "import type { Metadata } from 'next'\n..."
 * ```
 */
export function renderSubmodulePage(facts: LibraryFacts, subpath: string): string {
  return [
    "import type { Metadata } from 'next'",
    "import { SubmoduleDocPage } from '@/components/submodule-doc-page'",
    "import { getSubmoduleMetadata } from '@/lib/metadata'",
    '',
    'export function generateMetadata(): Metadata {',
    '  return getSubmoduleMetadata({',
    `    librarySlug: '${facts.routeSlug}',`,
    `    packageName: '${facts.packageName}',`,
    `    submodulePath: '${subpath}',`,
    `    path: '/docs/libraries/${facts.routeSlug}/${subpath}/',`,
    '  })',
    '}',
    '',
    `export default function ${names(subpath.replaceAll('/', '-')).className}Page() {`,
    `  return <SubmoduleDocPage librarySlug="${facts.routeSlug}" packageName="${facts.packageName}" submodulePath="${subpath}" />`,
    '}',
    '',
  ].join('\n')
}

/**
 * Every page the docs site needs for a library: its own page, its release
 * history, its architecture document when it has one, and one page per
 * secondary entry.
 *
 * @param facts - What was derived from the package's project
 * @returns The pages, each with the path it belongs at
 *
 * @example
 * ```typescript
 * docsPageFiles(facts).map((page) => page.path)
 * // ['apps/docs-site/src/app/docs/libraries/testing/page.tsx', 'apps/docs-site/src/app/docs/libraries/testing/releases/page.tsx', ...]
 * ```
 */
export function docsPageFiles(facts: LibraryFacts): DocsPageFile[] {
  const pageDir = posix.join(PAGES_ROOT, facts.routeSlug)
  return [
    { path: posix.join(pageDir, 'page.tsx'), content: renderLibraryPage(facts) },
    { path: posix.join(pageDir, 'releases', 'page.tsx'), content: renderReleasesPage(facts) },
    ...(facts.hasArchitecture ? [{ path: posix.join(pageDir, 'architecture', 'page.tsx'), content: renderArchitecturePage(facts) }] : []),
    ...facts.secondaryEntries.map((subpath) => ({
      path: posix.join(pageDir, subpath, 'page.tsx'),
      content: renderSubmodulePage(facts, subpath),
    })),
  ]
}
