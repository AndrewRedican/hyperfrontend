import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { MarkdownDocPage } from '@/components/document/markdown-doc-page'
import { packageAccentHue } from '@/components/package/package-accents'
import { getLibraryRules } from '@/lib/docs-loader'
import { getRulesMetadata } from '@/lib/metadata'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export function generateMetadata(): Metadata {
  return getRulesMetadata('linter')
}

export default function LinterRulesPage() {
  const markdown = getLibraryRules('linter')
  if (!markdown) notFound()
  return (
    <MarkdownDocPage
      markdown={markdown}
      accent={packageAccentHue('@hyperfrontend/linter')}
      descriptor={{
        route: '/docs/libraries/linter/rules',
        title: '@hyperfrontend/linter rule catalogue',
        subject: 'the @hyperfrontend/linter rule catalogue',
        kind: 'page',
      }}
      before={
        <>
          <Breadcrumb />
          <div className="mb-6">
            <Link href="/docs/libraries/linter" className="text-sm text-primary-600 hover:underline dark:text-primary-400">
              ← Back to @hyperfrontend/linter
            </Link>
          </div>
        </>
      }
    />
  )
}
