import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'project-scope',
    packageName: '@hyperfrontend/project-scope',
    submodulePath: 'tech/frontend',
    path: '/docs/libraries/project-scope/tech/frontend/',
  })
}

export default function FrontendPage() {
  return <SubmoduleDocPage librarySlug="project-scope" packageName="@hyperfrontend/project-scope" submodulePath="tech/frontend" />
}
