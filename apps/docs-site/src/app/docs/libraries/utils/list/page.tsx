import { LibraryDocPage } from '@/components/library-doc-page'

export default function ListUtilsPage() {
  return (
    <LibraryDocPage
      title="List Utils"
      packageName="@hyperfrontend/list-utils"
      slug="list"
      category="utils"
      fallbackDescription="Array and list manipulation utilities for efficient collection operations."
      fallbackFeatures={[
        'Array transformation functions',
        'List filtering and mapping',
        'Collection aggregation',
        'Set operations (union, intersection, difference)',
      ]}
    />
  )
}
