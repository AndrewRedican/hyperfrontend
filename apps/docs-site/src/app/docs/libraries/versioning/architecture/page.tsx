import { Breadcrumb } from '@/components/breadcrumb'
import { ReadmeContent } from '@/components/readme-content'
import { getLibraryArchitecture } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function VersioningArchitecturePage() {
  const content = getLibraryArchitecture('versioning')

  if (!content) {
    notFound()
  }

  const { processedContent, diagrams } = extractMermaidBlocks(content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Breadcrumb />

      <div className="mb-6">
        <Link href="/docs/libraries/versioning" className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Back to @hyperfrontend/versioning
        </Link>
      </div>

      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
    </>
  )
}
