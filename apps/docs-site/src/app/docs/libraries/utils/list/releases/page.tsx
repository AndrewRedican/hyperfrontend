import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('list-utils')
}

export default function ListUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/list" packageName="@hyperfrontend/list-utils" />
}
