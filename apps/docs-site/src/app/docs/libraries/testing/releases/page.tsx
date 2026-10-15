import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('testing')
}

export default function TestingReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/testing" packageName="@hyperfrontend/testing" />
}
