import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('server')
}

export default function ServerArchitecturePage() {
  return <LibraryArchitecturePage slug="server" packageName="@hyperfrontend/server" />
}
