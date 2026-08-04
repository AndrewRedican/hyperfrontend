import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'project-scope',
    packageName: '@hyperfrontend/project-scope',
    submodulePath: 'heuristics/project-type',
    path: '/docs/libraries/project-scope/heuristics/project-type/',
  })
}

export default function ProjectTypePage() {
  return <SubmoduleDocPage librarySlug="project-scope" packageName="@hyperfrontend/project-scope" submodulePath="heuristics/project-type" />
}
