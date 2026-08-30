import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('state-machine')
}

export default function StateMachineArchitecturePage() {
  return <LibraryArchitecturePage slug="state-machine" packageName="@hyperfrontend/state-machine" />
}
