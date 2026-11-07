import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'workspace',
    packageName: '@hyperfrontend/workspace',
    submodulePath: 'generators',
    path: '/docs/libraries/workspace/generators/',
  })
}

export default function GeneratorsPage() {
  return <SubmoduleDocPage librarySlug="workspace" packageName="@hyperfrontend/workspace" submodulePath="generators" />
}
