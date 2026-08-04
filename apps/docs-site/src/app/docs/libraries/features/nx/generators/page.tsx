import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'features',
    packageName: '@hyperfrontend/features',
    submodulePath: 'nx/generators',
    path: '/docs/libraries/features/nx/generators/',
  })
}

export default function NxGeneratorsPage() {
  return <SubmoduleDocPage librarySlug="features" packageName="@hyperfrontend/features" submodulePath="nx/generators" />
}
