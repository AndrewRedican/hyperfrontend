import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('linter')
}

export default function LinterArchitecturePage() {
  return <LibraryArchitecturePage slug="linter" packageName="@hyperfrontend/linter" />
}
