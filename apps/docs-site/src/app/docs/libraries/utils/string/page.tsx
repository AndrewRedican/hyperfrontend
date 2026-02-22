import { LibraryDocPage } from '@/components/library-doc-page'

export default function StringUtilsPage() {
  return (
    <LibraryDocPage
      title="String Utils"
      packageName="@hyperfrontend/string-utils"
      slug="string"
      category="utils"
      fallbackDescription="String manipulation and formatting utilities for text processing."
      fallbackFeatures={[
        'String formatting and templating',
        'Case conversion (camelCase, kebab-case, etc.)',
        'String validation and sanitization',
        'Text truncation and wrapping',
      ]}
    />
  )
}
