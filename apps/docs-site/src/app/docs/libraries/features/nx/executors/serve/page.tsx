import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'features',
    packageName: '@hyperfrontend/features',
    submodulePath: 'nx/executors/serve',
    path: '/docs/libraries/features/nx/executors/serve/',
  })
}

export default function NxServeExecutorPage() {
  return <SubmoduleDocPage librarySlug="features" packageName="@hyperfrontend/features" submodulePath="nx/executors/serve" />
}
