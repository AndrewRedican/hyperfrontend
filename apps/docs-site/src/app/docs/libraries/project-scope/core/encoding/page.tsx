import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'project-scope',
    packageName: '@hyperfrontend/project-scope',
    submodulePath: 'core/encoding',
    path: '/docs/libraries/project-scope/core/encoding/',
  })
}

export default function EncodingPage() {
  return <SubmoduleDocPage librarySlug="project-scope" packageName="@hyperfrontend/project-scope" submodulePath="core/encoding" />
}
