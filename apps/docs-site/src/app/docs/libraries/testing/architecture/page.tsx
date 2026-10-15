import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('testing')
}

export default function TestingArchitecturePage() {
  return <LibraryArchitecturePage slug="testing" packageName="@hyperfrontend/testing" />
}
