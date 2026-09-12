import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('nexus')
}

export default function NexusReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/nexus" packageName="@hyperfrontend/nexus" />
}
