import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('testing')
}

export default function TestingPage() {
  return (
    <LibraryDocPage
      title="Testing"
      packageName="@hyperfrontend/testing"
      slug="testing"
      category="core"
      fallbackDescription="Jest-style describe, it, expect and jest on Node's built-in test runner, with module mocks, fake timers, an optional DOM and a coverage gate."
    />
  )
}
