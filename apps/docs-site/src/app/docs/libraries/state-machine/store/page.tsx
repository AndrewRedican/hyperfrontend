import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'state-machine',
    packageName: '@hyperfrontend/state-machine',
    submodulePath: 'store',
    path: '/docs/libraries/state-machine/store/',
  })
}

export default function StorePage() {
  return <SubmoduleDocPage librarySlug="state-machine" packageName="@hyperfrontend/state-machine" submodulePath="store" />
}
