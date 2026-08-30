import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('nexus')
}

export default function NexusArchitecturePage() {
  return <LibraryArchitecturePage slug="nexus" packageName="@hyperfrontend/nexus" />
}
