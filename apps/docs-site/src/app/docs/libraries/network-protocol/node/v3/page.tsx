import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'network-protocol',
    packageName: '@hyperfrontend/network-protocol',
    submodulePath: 'node/v3',
    path: '/docs/libraries/network-protocol/node/v3/',
  })
}

export default function V3Page() {
  return <SubmoduleDocPage librarySlug="network-protocol" packageName="@hyperfrontend/network-protocol" submodulePath="node/v3" />
}
