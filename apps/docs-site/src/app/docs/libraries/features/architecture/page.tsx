import type { Metadata } from 'next'
import { LibraryArchitecturePage } from '@/components/library-architecture-page'
import { getArchitectureMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getArchitectureMetadata('features')
}

export default function FeaturesArchitecturePage() {
  return <LibraryArchitecturePage slug="features" packageName="@hyperfrontend/features" />
}
