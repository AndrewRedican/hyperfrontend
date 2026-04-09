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
  submoduleName: string
}

export async function SubmoduleDocPage({ librarySlug, packageName, submodulePath, submoduleName }: SubmoduleDocPageProps) {
  const content = getSubmoduleReadme(librarySlug, submodulePath)

  if (!content) {
    notFound()
  }

  let processed = removeBadges(content)
  processed = transformLinks(processed)

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

      <h1 className="font-display mb-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{submoduleName}</h1>

      <ReadmeContent html={html} mermaidDiagrams={diagrams} />
    </>
  )
}
