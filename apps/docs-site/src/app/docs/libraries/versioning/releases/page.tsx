import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('versioning')
}

export default function VersioningReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/versioning" packageName="@hyperfrontend/versioning" />
}
