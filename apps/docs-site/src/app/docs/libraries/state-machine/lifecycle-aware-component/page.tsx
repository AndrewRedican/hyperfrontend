import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'state-machine',
    packageName: '@hyperfrontend/state-machine',
    submodulePath: 'lifecycle-aware-component',
    path: '/docs/libraries/state-machine/lifecycle-aware-component/',
  })
}

export default function LifecycleAwareComponentPage() {
  return (
    <SubmoduleDocPage librarySlug="state-machine" packageName="@hyperfrontend/state-machine" submodulePath="lifecycle-aware-component" />
  )
}
