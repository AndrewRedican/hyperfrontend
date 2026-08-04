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
  return getArchitectureMetadata('network-protocol')
}

export default async function NetworkProtocolArchitecturePage() {
  const content = getLibraryArchitecture('network-protocol')

  if (!content) {
    notFound()
  }

  const { processedContent, diagrams } = extractMermaidBlocks(content)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Breadcrumb />

      <div className="mb-6">
        <Link href="/docs/libraries/network-protocol" className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Back to @hyperfrontend/network-protocol
        </Link>
      </div>

      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
    </>
  )
}
