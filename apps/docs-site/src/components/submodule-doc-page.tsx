import { Breadcrumb } from '@/components/breadcrumb'
import { ReadmeContent } from '@/components/readme-content'
import { removeBadges, transformLinks } from '@/lib/content'
import { getSubmoduleReadme } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface SubmoduleDocPageProps {
  librarySlug: string
  packageName: string
  submodulePath: string
}

export async function SubmoduleDocPage({ librarySlug, packageName, submodulePath }: SubmoduleDocPageProps) {
  const content = getSubmoduleReadme(librarySlug, submodulePath)

  if (!content) {
    notFound()
  }

  let processed = removeBadges(content)
  processed = transformLinks(processed, { librarySlug, submodulePath })

  const { processedContent, diagrams } = extractMermaidBlocks(processed)
  const html = await markdownToHtml(processedContent)

  return (
    <>
      <Breadcrumb />

      <div className="mb-6">
        <Link href={`/docs/libraries/${librarySlug}`} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Back to {packageName}
        </Link>
      </div>

      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
    </>
  )
}
