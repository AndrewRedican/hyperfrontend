import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('data-utils')
}

export default function DataUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/data" packageName="@hyperfrontend/data-utils" />
}
