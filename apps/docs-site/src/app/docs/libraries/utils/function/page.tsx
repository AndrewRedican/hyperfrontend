import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('function-utils')
}

export default function FunctionUtilsPage() {
  return (
    <LibraryDocPage
      title="Function Utils"
      packageName="@hyperfrontend/function-utils"
      slug="function"
      category="utils"
      fallbackDescription="Function composition and manipulation utilities for functional programming patterns."
      fallbackFeatures={[
        'Function composition',
        'Currying and partial application',
        'Memoization helpers',
        'Function debouncing and throttling',
      ]}
    />
  )
}
