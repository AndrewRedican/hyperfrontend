import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { ReadmeContent } from '@/components/readme-content'
import { getLibraryArchitecture } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import { getArchitectureMetadata } from '@/lib/metadata'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('nexus')
}

export default async function NexusArchitecturePage() {
  const content = getLibraryArchitecture('nexus')

  if (!content) {
    notFound()
  }

  const { processedContent, diagrams } = extractMermaidBlocks(content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Breadcrumb />

      <div className="mb-6">
        <Link href="/docs/libraries/nexus" className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Back to @hyperfrontend/nexus
        </Link>
      </div>

      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
    </>
  )
}
