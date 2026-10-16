import { describe, expect, it } from '@hyperfrontend/testing'
import { docsPageFiles, renderArchitecturePage, renderLibraryPage, renderReleasesPage, renderSubmodulePage } from './docs-pages'
import { deriveLibraryFacts } from './library-facts'

const TESTING = deriveLibraryFacts({
  projectName: 'lib-testing',
  projectRoot: 'libs/testing',
  packageName: '@hyperfrontend/testing',
  description: 'Jest-style "describe" on node:test.',
  tags: ['type:core'],
  exports: { '.': './src/index.js', './runner': './src/runner/index.js', './nx/executors': './src/nx/executors/index.js' },
  hasArchitecture: true,
})

const JSON_UTILS = deriveLibraryFacts({
  projectName: 'lib-json-utils',
  projectRoot: 'libs/utils/json',
  packageName: '@hyperfrontend/json-utils',
  description: 'JSON Schema validation.',
  tags: [],
  exports: { '.': './src/index.js' },
  hasArchitecture: false,
})

describe('renderLibraryPage', () => {
  it('renders the page the way the hand-written ones are shaped, escaping the description', () => {
    expect(renderLibraryPage(TESTING)).toBe(
      [
        "import type { Metadata } from 'next'",
        "import { LibraryDocPage } from '@/components/library-doc-page'",
        "import { getLibraryMetadata } from '@/lib/metadata'",
        '',
        'export function generateMetadata(): Metadata {',
        "  return getLibraryMetadata('testing')",
        '}',
        '',
        'export default function TestingPage() {',
        '  return (',
        '    <LibraryDocPage',
        '      title="Testing"',
        '      packageName="@hyperfrontend/testing"',
        '      slug="testing"',
        '      category="core"',
        '      fallbackDescription="Jest-style &quot;describe&quot; on node:test."',
        '    />',
        '  )',
        '}',
        '',
      ].join('\n')
    )
  })

  it('gives a utility its manifest slug for the metadata', () => {
    expect(renderLibraryPage(JSON_UTILS)).toEqual(expect.stringContaining("getLibraryMetadata('json-utils')"))
  })

  it('gives a utility its last segment for the page', () => {
    expect(renderLibraryPage(JSON_UTILS)).toEqual(expect.stringContaining('      slug="json"\n      category="utils"'))
  })
})

describe('renderReleasesPage', () => {
  it('renders the changelog page under the package route', () => {
    expect(renderReleasesPage(JSON_UTILS)).toBe(
      [
        "import type { Metadata } from 'next'",
        "import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'",
        "import { getChangelogMetadata } from '@/lib/metadata'",
        '',
        'export function generateMetadata(): Metadata {',
        "  return getChangelogMetadata('json-utils')",
        '}',
        '',
        'export default function JsonUtilsReleasesPage() {',
        '  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/json" packageName="@hyperfrontend/json-utils" />',
        '}',
        '',
      ].join('\n')
    )
  })
})

describe('renderArchitecturePage', () => {
  it('renders the architecture page', () => {
    expect(renderArchitecturePage(TESTING)).toBe(
      [
        "import type { Metadata } from 'next'",
        "import { LibraryArchitecturePage } from '@/components/library-architecture-page'",
        "import { getArchitectureMetadata } from '@/lib/metadata'",
        '',
        'export function generateMetadata(): Metadata {',
        "  return getArchitectureMetadata('testing')",
        '}',
        '',
        'export default function TestingArchitecturePage() {',
        '  return <LibraryArchitecturePage slug="testing" packageName="@hyperfrontend/testing" />',
        '}',
        '',
      ].join('\n')
    )
  })
})

describe('renderSubmodulePage', () => {
  it('renders a nested entry with the route in its metadata and a name made of its segments', () => {
    expect(renderSubmodulePage(TESTING, 'nx/executors')).toBe(
      [
        "import type { Metadata } from 'next'",
        "import { SubmoduleDocPage } from '@/components/submodule-doc-page'",
        "import { getSubmoduleMetadata } from '@/lib/metadata'",
        '',
        'export function generateMetadata(): Metadata {',
        '  return getSubmoduleMetadata({',
        "    librarySlug: 'testing',",
        "    packageName: '@hyperfrontend/testing',",
        "    submodulePath: 'nx/executors',",
        "    path: '/docs/libraries/testing/nx/executors/',",
        '  })',
        '}',
        '',
        'export default function NxExecutorsPage() {',
        '  return <SubmoduleDocPage librarySlug="testing" packageName="@hyperfrontend/testing" submodulePath="nx/executors" />',
        '}',
        '',
      ].join('\n')
    )
  })
})

describe('docsPageFiles', () => {
  it('lists the page, the releases, the architecture document and one page per secondary entry', () => {
    expect(docsPageFiles(TESTING).map((page) => page.path)).toEqual([
      'apps/docs-site/src/app/docs/libraries/testing/page.tsx',
      'apps/docs-site/src/app/docs/libraries/testing/releases/page.tsx',
      'apps/docs-site/src/app/docs/libraries/testing/architecture/page.tsx',
      'apps/docs-site/src/app/docs/libraries/testing/nx/executors/page.tsx',
      'apps/docs-site/src/app/docs/libraries/testing/runner/page.tsx',
    ])
  })

  it('leaves out the architecture page for a library without the document and routes a utility under utils', () => {
    expect(docsPageFiles(JSON_UTILS)).toEqual([
      { path: 'apps/docs-site/src/app/docs/libraries/utils/json/page.tsx', content: renderLibraryPage(JSON_UTILS) },
      { path: 'apps/docs-site/src/app/docs/libraries/utils/json/releases/page.tsx', content: renderReleasesPage(JSON_UTILS) },
    ])
  })
})
