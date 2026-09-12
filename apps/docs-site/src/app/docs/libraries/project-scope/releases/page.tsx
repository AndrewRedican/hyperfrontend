import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('project-scope')
}

export default function ProjectScopeReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/project-scope" packageName="@hyperfrontend/project-scope" />
}
