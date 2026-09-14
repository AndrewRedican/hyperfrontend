import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('questions')
}

export default function QuestionsReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/questions" packageName="@hyperfrontend/questions" />
}
