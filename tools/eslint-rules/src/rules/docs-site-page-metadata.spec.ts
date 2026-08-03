import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './docs-site-page-metadata'

type TestOptions = readonly []
type MessageIds = 'missingMetadata' | 'clientPage' | 'placeholderValue' | 'wrongMetadataArg'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

/**
 * Build the absolute filename of a docs-site page for a route directory.
 *
 * @param route - Route directory relative to the app dir.
 * @returns The page filename.
 */
function pageFile(route: string): string {
  return route === '' ? '/repo/apps/docs-site/src/app/page.tsx' : `/repo/apps/docs-site/src/app/${route}/page.tsx`
}

/**
 * Valid test cases - conformant pages and files the rule must ignore
 */
const validCases: ValidTestCase<TestOptions>[] = [
  {
    code: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quick Start',
  description: 'Get a feature running in minutes.',
}

export default function Page() { return null }`,
    filename: pageFile('docs/quick-start'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/parse',
    path: '/docs/libraries/versioning/commits/parse/',
  })
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning/commits/parse'),
  },
  {
    code: `import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Article' }
}

export default function Page() { return null }`,
    filename: pageFile('articles/[slug]'),
  },
  {
    code: `import type { Metadata } from 'next'

export const generateMetadata = (): Metadata => ({ title: 'Demos' })

export default function Page() { return null }`,
    filename: pageFile('demos'),
  },
  {
    code: `import type { Metadata } from 'next'

const metadata: Metadata = { title: 'Contributing', description: 'How to contribute.' }

export { metadata }

export default function Page() { return null }`,
    filename: pageFile('docs/contributing'),
  },
  {
    code: `export { metadata } from './shared-metadata'

export default function Page() { return null }`,
    filename: pageFile('docs/core-concepts'),
  },
  {
    code: `export function Content() { return null }`,
    filename: '/repo/apps/docs-site/src/app/docs/core-concepts/content.tsx',
  },
  {
    code: `export default function Page() { return null }`,
    filename: '/repo/apps/docs-site/src/components/page.tsx',
  },
  {
    code: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('versioning')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('string-utils')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/utils/string'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('versioning')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning/architecture'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/immutable-api',
    packageName: '@hyperfrontend/immutable-api-utils',
    submodulePath: 'built-in-copy/array',
    path: '/docs/libraries/utils/immutable-api/built-in-copy/array/',
  })
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/utils/immutable-api/built-in-copy/array'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

const slug = 'versioning'

export function generateMetadata(): Metadata {
  return getLibraryMetadata(slug)
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('whatever')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning/commits/parse'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata()
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning'),
  },
  {
    code: `import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/parse',
    path: 42,
  })
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning/commits/parse'),
  },
  {
    code: `import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Docs', description: 'The docs.' }

export default function Page() {
  const options = { title: undefined }
  return options === null ? null : null
}`,
    filename: pageFile('docs'),
  },
  {
    code: `import type { Metadata } from 'next'

const draft = { title: undefined }

export const metadata: Metadata = { title: 'Docs', description: 'The docs.' }

export default function Page() { return draft === null ? null : null }`,
    filename: pageFile('docs'),
  },
  {
    code: `import type { Metadata } from 'next'

const key = 'title'

export const metadata: Metadata = { [key]: undefined, title: 'Docs', description: 'The docs.' }

export default function Page() { return null }`,
    filename: pageFile('docs'),
  },
]

/**
 * Invalid test cases - missing metadata with route-derived autofixes,
 * client pages, placeholders, and mismatched helper arguments
 */
const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    code: `import { Breadcrumb } from '@/components/breadcrumb'
import Link from 'next/link'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import Link from 'next/link'

export const metadata: Metadata = {
  title: undefined,
  description: undefined,
}

export default function Page() { return null }`,
    filename: pageFile('docs/new-guide'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: undefined,
  description: undefined,
}

export default function Page() { return null }`,
    filename: pageFile('demos'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: ``,
    output: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: undefined,
  description: undefined,
}
`,
    filename: pageFile('docs/empty'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `import { LibraryDocPage } from '@/components/library-doc-page'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('questions')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/questions'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('time-utils')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/utils/time'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `import { notFound } from 'next/navigation'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getArchitectureMetadata } from '@/lib/metadata'
import { notFound } from 'next/navigation'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('nexus')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/nexus/architecture'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'builder',
    packageName: '@hyperfrontend/builder',
    submodulePath: 'bundle/dependencies/worker',
    path: '/docs/libraries/builder/bundle/dependencies/worker/',
  })
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/builder/bundle/dependencies/worker'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/ui',
    packageName: '@hyperfrontend/ui-utils',
    submodulePath: 'dom',
    path: '/docs/libraries/utils/ui/dom/',
  })
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/utils/ui/dom'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'

export function generateMetadata(): Metadata {
  return {
    title: undefined,
    description: undefined,
  }
}

export default function Page() { return null }`,
    filename: pageFile('articles/[slug]'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: undefined,
  description: undefined,
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: undefined,
  description: undefined,
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/utils'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: undefined,
  description: undefined,
}

export default function Page() { return null }`,
    filename: pageFile(''),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `'use client'

export default function Page() { return null }`,
    filename: pageFile('docs/interactive'),
    errors: [{ messageId: 'clientPage' }],
  },
  {
    code: `'use client'

export const metadata = { title: 'Broken' }

export default function Page() { return null }`,
    filename: pageFile('docs/interactive'),
    errors: [{ messageId: 'clientPage' }],
  },
  {
    code: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: undefined,
  description: 'Real description.',
}

export default function Page() { return null }`,
    filename: pageFile('docs/new-guide'),
    errors: [{ messageId: 'placeholderValue', data: { property: 'title' } }],
  },
  {
    code: `import type { Metadata } from 'next'

export function generateMetadata(): Metadata {
  return {
    title: undefined,
    description: undefined,
  }
}

export default function Page() { return null }`,
    filename: pageFile('articles/[slug]'),
    errors: [
      { messageId: 'placeholderValue', data: { property: 'title' } },
      { messageId: 'placeholderValue', data: { property: 'description' } },
    ],
  },
  {
    code: `export const metadata = {
  'title': undefined,
  description: 'Real description.',
}

export default function Page() { return null }`,
    filename: pageFile('docs/new-guide'),
    errors: [{ messageId: 'placeholderValue', data: { property: 'title' } }],
  },
  {
    code: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('json')
}

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('json-utils')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/utils/json'),
    errors: [{ messageId: 'wrongMetadataArg', data: { property: 'slug', expected: "'json-utils'" } }],
  },
  {
    code: `import type { Metadata } from 'next'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('state')
}

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('state-machine')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/state-machine/architecture'),
    errors: [{ messageId: 'wrongMetadataArg', data: { property: 'slug', expected: "'state-machine'" } }],
  },
  {
    code: `import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/parse',
    path: '/docs/libraries/versioning/commits/parse/',
  })
}

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/format',
    path: '/docs/libraries/versioning/commits/format/',
  })
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/versioning/commits/format'),
    errors: [
      { messageId: 'wrongMetadataArg', data: { property: 'submodulePath', expected: "'commits/format'" } },
      { messageId: 'wrongMetadataArg', data: { property: 'path', expected: "'/docs/libraries/versioning/commits/format/'" } },
    ],
  },
  {
    code: `import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE } from '@/lib/metadata'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE, getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('logging')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/logging'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `import { getAllArticles } from '@/lib/articles'
import { SITE_URL } from '@/lib/site'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getAllArticles } from '@/lib/articles'
import { getLibraryMetadata } from '@/lib/metadata'
import { SITE_URL } from '@/lib/site'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('features')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/features'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('web-worker')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/web-worker'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `import {} from '@/lib/metadata'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import {} from '@/lib/metadata'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('logging')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/logging'),
    errors: [{ messageId: 'missingMetadata' }],
  },
  {
    code: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export default function Page() { return null }`,
    output: `import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('logging')
}

export default function Page() { return null }`,
    filename: pageFile('docs/libraries/logging'),
    errors: [{ messageId: 'missingMetadata' }],
  },
]

ruleTester.run('docs-site-page-metadata', rule, {
  valid: validCases,
  invalid: invalidCases,
})
