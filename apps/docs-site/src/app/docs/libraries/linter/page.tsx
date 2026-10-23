import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('linter')
}

export default function LinterPage() {
  return (
    <LibraryDocPage
      title="Linter"
      packageName="@hyperfrontend/linter"
      slug="linter"
      category="supporting"
      fallbackDescription="A linter for TypeScript, JavaScript, JSX, JSON and Markdown with its own parsers and no external runtime packages."
    />
  )
}
