import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('state-machine')
}

export default function StateMachineReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/state-machine" packageName="@hyperfrontend/state-machine" />
}
