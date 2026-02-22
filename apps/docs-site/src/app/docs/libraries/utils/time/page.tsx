import { LibraryDocPage } from '@/components/library-doc-page'

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
