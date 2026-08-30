import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('builder')
}

export default function BuilderArchitecturePage() {
  return <LibraryArchitecturePage slug="builder" packageName="@hyperfrontend/builder" />
}
