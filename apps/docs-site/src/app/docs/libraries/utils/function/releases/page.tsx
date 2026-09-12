import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('function-utils')
}

export default function FunctionUtilsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/utils/function" packageName="@hyperfrontend/function-utils" />
}
