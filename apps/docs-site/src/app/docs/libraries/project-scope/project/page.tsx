import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'project-scope',
    packageName: '@hyperfrontend/project-scope',
    submodulePath: 'project',
    path: '/docs/libraries/project-scope/project/',
  })
}

export default function ProjectPage() {
  return <SubmoduleDocPage librarySlug="project-scope" packageName="@hyperfrontend/project-scope" submodulePath="project" />
}
