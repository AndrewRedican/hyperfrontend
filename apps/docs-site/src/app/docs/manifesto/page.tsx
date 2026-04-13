import { Breadcrumb } from '@/components/breadcrumb'
import { ReadmeContent } from '@/components/readme-content'
import { getManifesto } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'

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

  const { processedContent, diagrams } = extractMermaidBlocks(content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Breadcrumb />
      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
    </>
  )
}
