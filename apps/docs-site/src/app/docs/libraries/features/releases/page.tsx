import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('features')
}

export default function FeaturesReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/features" packageName="@hyperfrontend/features" />
}
