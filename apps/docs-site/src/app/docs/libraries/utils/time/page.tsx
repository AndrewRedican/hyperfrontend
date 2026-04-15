import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('time-utils')
}

export default function TimeUtilsPage() {
  return (
    <LibraryDocPage
      title="Time Utils"
      packageName="@hyperfrontend/time-utils"
      slug="time"
      category="utils"
      fallbackDescription="Time and date manipulation utilities for working with temporal data."
      fallbackFeatures={['Date formatting and parsing', 'Duration calculations', 'Timezone handling', 'Relative time formatting']}
    />
  )
}
