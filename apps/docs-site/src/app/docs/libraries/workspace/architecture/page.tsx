import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('workspace')
}

export default function WorkspaceArchitecturePage() {
  return <LibraryArchitecturePage slug="workspace" packageName="@hyperfrontend/workspace" />
}
