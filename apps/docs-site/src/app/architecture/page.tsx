import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { ReadmeContent } from '@/components/readme-content'
import { getRootArchitecture } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import Link from 'next/link'

export default async function ArchitecturePage() {
  const content = getRootArchitecture()

  if (!content) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Architecture</h1>
         <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Architecture documentation is currently being prepared. In the meantime, 
           you can explore the main documentation and available library pages.</p>
          <div className="mt-8">
  <Link
    href="/docs"
    className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
  >
    ← Back to Documentation
  </Link>
</div>
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
