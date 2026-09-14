import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('time-utils')
}

export default function TimeUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/time" packageName="@hyperfrontend/time-utils" />
}
