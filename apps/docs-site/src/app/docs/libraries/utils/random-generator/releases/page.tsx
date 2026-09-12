import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('random-generator-utils')
}

export default function RandomGeneratorUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/random-generator" packageName="@hyperfrontend/random-generator-utils" />
}
