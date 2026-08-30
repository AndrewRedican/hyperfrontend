import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('versioning')
}

export default function VersioningArchitecturePage() {
  return <LibraryArchitecturePage slug="versioning" packageName="@hyperfrontend/versioning" />
}
