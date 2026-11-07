import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('workspace')
}

export default function WorkspaceReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/workspace" packageName="@hyperfrontend/workspace" />
}
