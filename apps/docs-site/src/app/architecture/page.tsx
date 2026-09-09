import type { Metadata } from 'next'
import { DocsChrome } from '@/components/docs-chrome'
import { MarkdownDocPage } from '@/components/document/markdown-doc-page'
import { getRootArchitecture } from '@/lib/docs-loader'
import { documentSubject } from '@/lib/document-model'
import { markdownAlternate } from '@/lib/metadata'

export const metadata: Metadata = {
  title: 'Architecture',
  alternates: { canonical: '/architecture/', types: markdownAlternate('/architecture', 'Architecture') },
  description:
    'Layered architecture for runtime micro-frontend integration enabling frameworks to communicate through secure, contract-validated messaging.',
}

export default async function ArchitecturePage() {
  const content = getRootArchitecture()

  if (!content) {
    return (
      <DocsChrome>
        <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Architecture</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Architecture documentation is coming soon. Check back later.</p>
      </DocsChrome>
    )
  }

  return (
    <DocsChrome>
      <MarkdownDocPage
        markdown={content}
        descriptor={{
          route: '/architecture',
          title: 'Architecture',
          subject: documentSubject('page', 'the HyperFrontend architecture'),
          kind: 'page',
        }}
      />
    </DocsChrome>
  )
}
