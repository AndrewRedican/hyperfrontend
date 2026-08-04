import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'network-protocol',
    packageName: '@hyperfrontend/network-protocol',
    submodulePath: 'node/data',
    path: '/docs/libraries/network-protocol/node/data/',
  })
}

export default function DataPage() {
  return <SubmoduleDocPage librarySlug="network-protocol" packageName="@hyperfrontend/network-protocol" submodulePath="node/data" />
}
