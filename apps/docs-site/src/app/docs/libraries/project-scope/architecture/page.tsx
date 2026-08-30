import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('project-scope')
}

export default function ProjectScopeArchitecturePage() {
  return <LibraryArchitecturePage slug="project-scope" packageName="@hyperfrontend/project-scope" />
}
