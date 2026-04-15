import type { Metadata } from 'next'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { ReadmeContent } from '@/components/readme-content'
import { getRootArchitecture } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'

export const metadata: Metadata = {
  title: 'Architecture',
  description:
    'Layered architecture for runtime micro-frontend integration enabling frameworks to communicate through secure, contract-validated messaging.',
}

export default async function ArchitecturePage() {
  const content = getRootArchitecture()

  if (!content) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Architecture</h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Architecture documentation is coming soon. Check back later.</p>
        </main>
        <Footer />
      </>
    )
  }

  const { processedContent, diagrams } = extractMermaidBlocks(content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <ReadmeContent html={html} mermaidDiagrams={diagrams} />
      </main>
      <Footer />
    </>
  )
}
