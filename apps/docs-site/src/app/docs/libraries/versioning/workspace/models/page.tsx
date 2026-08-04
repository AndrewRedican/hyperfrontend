import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'workspace/models',
    path: '/docs/libraries/versioning/workspace/models/',
  })
}

export default function ModelsPage() {
  return <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="workspace/models" />
}
