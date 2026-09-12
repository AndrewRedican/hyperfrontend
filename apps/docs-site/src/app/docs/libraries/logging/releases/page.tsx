import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('logging')
}

export default function LoggingReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/logging" packageName="@hyperfrontend/logging" />
}
