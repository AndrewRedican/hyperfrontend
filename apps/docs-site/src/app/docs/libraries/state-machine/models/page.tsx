import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'state-machine',
    packageName: '@hyperfrontend/state-machine',
    submodulePath: 'models',
    path: '/docs/libraries/state-machine/models/',
  })
}

export default function ModelsPage() {
  return <SubmoduleDocPage librarySlug="state-machine" packageName="@hyperfrontend/state-machine" submodulePath="models" />
}
