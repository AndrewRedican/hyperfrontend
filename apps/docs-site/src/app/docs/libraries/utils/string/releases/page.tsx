import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('string-utils')
}

export default function StringUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/string" packageName="@hyperfrontend/string-utils" />
}
