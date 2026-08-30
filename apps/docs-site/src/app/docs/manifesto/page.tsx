import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { MarkdownDocPage } from '@/components/document/markdown-doc-page'
import { getManifesto } from '@/lib/docs-loader'
import { documentSubject } from '@/lib/document-model'
import { markdownAlternate } from '@/lib/metadata'

export const metadata: Metadata = {
  title: 'Manifesto',
  alternates: { canonical: '/docs/manifesto/', types: markdownAlternate('/docs/manifesto', 'Manifesto') },
  description: "The vision behind hyperfrontend: why it exists, where it's going, and what it won't build.",
}

export default async function ManifestoPage() {
  const content = getManifesto()

  if (!content) {
    return (
      <>
        <Breadcrumb />
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Manifesto</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Manifesto documentation is coming soon. Check back later.</p>
      </>
    )
  }

  return (
    <MarkdownDocPage
      markdown={content}
      descriptor={{
        route: '/docs/manifesto',
        title: 'Manifesto',
        subject: documentSubject('page', 'the HyperFrontend manifesto'),
        kind: 'page',
      }}
      before={<Breadcrumb />}
    />
  )
}
