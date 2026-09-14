import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('builder')
}

export default function BuilderReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/builder" packageName="@hyperfrontend/builder" />
}
