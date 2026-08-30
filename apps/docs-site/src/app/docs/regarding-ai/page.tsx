import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { MarkdownDocPage } from '@/components/document/markdown-doc-page'
import { getRegardingAi } from '@/lib/docs-loader'
import { documentSubject } from '@/lib/document-model'
import { markdownAlternate } from '@/lib/metadata'

export const metadata: Metadata = {
  title: 'Regarding AI',
  alternates: { canonical: '/docs/regarding-ai/', types: markdownAlternate('/docs/regarding-ai', 'Regarding AI') },
  description: 'How AI and LLMs are used in hyperfrontend development with a human-in-the-loop verification process.',
}

export default async function RegardingAiPage() {
  const content = getRegardingAi()

  if (!content) {
    return (
      <>
        <Breadcrumb />
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Regarding AI</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">AI documentation is coming soon. Check back later.</p>
      </>
    )
  }

  return (
    <MarkdownDocPage
      markdown={content}
      descriptor={{
        route: '/docs/regarding-ai',
        title: 'Regarding AI',
        subject: documentSubject('page', "HyperFrontend's position on AI-assisted development"),
        kind: 'page',
      }}
      before={<Breadcrumb />}
    />
  )
}
