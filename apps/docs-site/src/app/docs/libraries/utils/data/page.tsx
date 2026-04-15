import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('data-utils')
}

export default function DataUtilsPage() {
  return (
    <LibraryDocPage
      title="Data Utils"
      packageName="@hyperfrontend/data-utils"
      slug="data"
      category="utils"
      fallbackDescription="Data manipulation utilities for transforming and validating data structures."
      fallbackFeatures={[
        'Data transformation functions',
        'Object manipulation utilities',
        'Data validation helpers',
        'Type-safe data operations',
      ]}
    />
  )
}
