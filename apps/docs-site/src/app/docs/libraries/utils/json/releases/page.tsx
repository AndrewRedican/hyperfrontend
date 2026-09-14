import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('json-utils')
}

export default function JsonUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/json" packageName="@hyperfrontend/json-utils" />
}
