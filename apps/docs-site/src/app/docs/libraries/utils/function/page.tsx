import { LibraryDocPage } from '@/components/library-doc-page'

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
