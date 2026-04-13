import { Breadcrumb } from '@/components/breadcrumb'
import { ReadmeContent } from '@/components/readme-content'
import { getRegardingAi } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'

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

  const { processedContent, diagrams } = extractMermaidBlocks(content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Breadcrumb />
      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
    </>
  )
}
