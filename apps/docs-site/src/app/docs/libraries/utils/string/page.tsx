import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('string-utils')
}

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
