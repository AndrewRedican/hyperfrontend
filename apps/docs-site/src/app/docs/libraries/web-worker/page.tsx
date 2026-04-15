import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('web-worker')
}

export default function WebWorkerPage() {
  return (
    <LibraryDocPage
      title="Web Worker"
      packageName="@hyperfrontend/web-worker"
      slug="web-worker"
      category="supporting"
      fallbackDescription="Web Worker abstraction that provides shared interfaces for running code in background threads with consistent messaging patterns."
      fallbackFeatures={[
        'Unified worker creation and management',
        'Standardized message passing interface',
        'Error handling and worker lifecycle management',
        'Support for inline workers via Blob URLs',
        'Type-safe message contracts',
      ]}
    />
  )
}
