import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'project-scope',
    packageName: '@hyperfrontend/project-scope',
    submodulePath: 'project/root',
    path: '/docs/libraries/project-scope/project/root/',
  })
}

export default function RootPage() {
  return <SubmoduleDocPage librarySlug="project-scope" packageName="@hyperfrontend/project-scope" submodulePath="project/root" />
}
