import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('linter')
}

export default function LinterReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/linter" packageName="@hyperfrontend/linter" />
}
