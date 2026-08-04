import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'state-machine',
    packageName: '@hyperfrontend/state-machine',
    submodulePath: 'events',
    path: '/docs/libraries/state-machine/events/',
  })
}

export default function EventsPage() {
  return <SubmoduleDocPage librarySlug="state-machine" packageName="@hyperfrontend/state-machine" submodulePath="events" />
}
