import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('workspace')
}

export default function WorkspacePage() {
  return (
    <LibraryDocPage
      title="Workspace"
      packageName="@hyperfrontend/workspace"
      slug="workspace"
      category="supporting"
      fallbackDescription="Workspace graph, task runner and generators behind the hf command line."
    />
  )
}
