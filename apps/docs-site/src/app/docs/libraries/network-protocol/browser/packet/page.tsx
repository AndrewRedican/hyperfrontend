import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'network-protocol',
    packageName: '@hyperfrontend/network-protocol',
    submodulePath: 'browser/packet',
    path: '/docs/libraries/network-protocol/browser/packet/',
  })
}

export default function PacketPage() {
  return <SubmoduleDocPage librarySlug="network-protocol" packageName="@hyperfrontend/network-protocol" submodulePath="browser/packet" />
}
