import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('network-protocol')
}

export default function NetworkProtocolReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/network-protocol" packageName="@hyperfrontend/network-protocol" />
}
