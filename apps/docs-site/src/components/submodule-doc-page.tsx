import type { TypeDocOutput } from '@/components/api-reference'
import { CopyButton, ScopedApiReference } from '@/components/api-reference'
import { Breadcrumb } from '@/components/breadcrumb'
import { ReadmeContent } from '@/components/readme-content'
import { removeBadges, transformLinks } from '@/lib/content'
import { getLibraryApi, getSubmoduleReadme } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import Link from 'next/link'

interface SubmoduleDocPageProps {
  /** Library URL slug (e.g., 'versioning'). */
  librarySlug: string
  /** Full npm package name (e.g., '@hyperfrontend/versioning'). */
  packageName: string
  /** Submodule subpath (e.g., 'commits/parse'). */
  submodulePath: string
}

/**
 * Renders a documentation page for one secondary entrypoint of a library.
 *
 * Layout: breadcrumb → back link → import header → README (or stub when missing)
 * → scoped API reference. The page degrades gracefully: a missing README renders
 * a one-line placeholder rather than a 404, so the import header and embedded API
 * reference remain available.
 * @param props - Component props.
 * @param props.librarySlug - Library URL slug.
 * @param props.packageName - npm package name.
 * @param props.submodulePath - Submodule subpath identifying the secondary entrypoint.
 * @example
 * <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="commits/parse" />
 */
export async function SubmoduleDocPage({ librarySlug, packageName, submodulePath }: SubmoduleDocPageProps) {
  const importPath = `${packageName}/${submodulePath}`
  const importStatement = `import {} from '${importPath}'`
  const apiData = getLibraryApi(librarySlug) as TypeDocOutput | null
  const readmeContent = getSubmoduleReadme(librarySlug, submodulePath)

  let readmeHtml: string | null = null
  let readmeDiagrams: ReturnType<typeof extractMermaidBlocks>['diagrams'] = []

  if (readmeContent) {
    let processed = removeBadges(readmeContent)
    processed = transformLinks(processed, { librarySlug, submodulePath })
    const extracted = extractMermaidBlocks(processed)
    readmeDiagrams = extracted.diagrams
    readmeHtml = await markdownToHtml(extracted.processedContent)
  }

  return (
    <>
      <Breadcrumb />

      <div className="mb-6">
        <Link href={`/docs/libraries/${librarySlug}`} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← Back to {packageName}
        </Link>
      </div>

      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between gap-4">
        <code className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">{importPath}</code>
        <CopyButton text={importStatement} size="sm" />
      </div>

      {readmeHtml ? (
        <ReadmeContent html={readmeHtml} mermaidDiagrams={readmeDiagrams} />
      ) : (
        <p className="text-sm italic text-slate-500 dark:text-slate-400 mb-6">This submodule does not yet have a written description.</p>
      )}

      {apiData && <ScopedApiReference data={apiData} subpath={submodulePath} />}
    </>
  )
}
