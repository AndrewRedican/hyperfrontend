import { LibraryDocPage } from '@/components/library-doc-page'

export default function JsonUtilsPage() {
  return (
    <LibraryDocPage
      title="JSON Utils"
      packageName="@hyperfrontend/json-utils"
      slug="json"
      category="utils"
      fallbackDescription="JSON parsing, serialization, and manipulation utilities with enhanced error handling."
      fallbackFeatures={[
        'Safe JSON parsing with error handling',
        'JSON serialization helpers',
        'JSON Schema validation',
        'JSON path utilities',
      ]}
    />
  )
}
