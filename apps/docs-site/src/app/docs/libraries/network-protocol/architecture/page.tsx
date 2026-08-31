import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('network-protocol')
}

export default function NetworkProtocolArchitecturePage() {
  return <LibraryArchitecturePage slug="network-protocol" packageName="@hyperfrontend/network-protocol" />
}
