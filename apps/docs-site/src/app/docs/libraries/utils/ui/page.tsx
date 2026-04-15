import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('ui-utils')
}

export default function UiUtilsPage() {
  return (
    <LibraryDocPage
      title="UI Utils"
      packageName="@hyperfrontend/ui-utils"
      slug="ui"
      category="utils"
      fallbackDescription="UI and DOM utilities for building interactive user interfaces."
      fallbackFeatures={['DOM manipulation helpers', 'Event handling utilities', 'Animation helpers', 'Responsive design utilities']}
    />
  )
}
