import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('immutable-api-utils')
}

export default function ImmutableApiUtilsPage() {
  return (
    <LibraryDocPage
      title="Immutable API Utils"
      packageName="@hyperfrontend/immutable-api-utils"
      slug="immutable-api"
      category="utils"
      fallbackDescription="Immutable data structure utilities for working with persistent data structures."
      fallbackFeatures={[
        'Immutable object operations',
        'Persistent data structures',
        'Deep clone and merge utilities',
        'Copy-on-write patterns',
      ]}
    />
  )
}
