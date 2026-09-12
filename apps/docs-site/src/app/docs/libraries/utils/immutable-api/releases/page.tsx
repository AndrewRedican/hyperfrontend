import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('immutable-api-utils')
}

export default function ImmutableApiUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/immutable-api" packageName="@hyperfrontend/immutable-api-utils" />
}
