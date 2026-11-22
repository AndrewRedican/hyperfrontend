import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('server')
}

export default function ServerReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/server" packageName="@hyperfrontend/server" />
}
