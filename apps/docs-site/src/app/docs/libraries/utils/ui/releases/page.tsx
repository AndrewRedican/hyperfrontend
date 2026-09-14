import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('ui-utils')
}

export default function UiUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/ui" packageName="@hyperfrontend/ui-utils" />
}
