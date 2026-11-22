import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('server')
}

export default function ServerPage() {
  return (
    <LibraryDocPage
      title="Server"
      packageName="@hyperfrontend/server"
      slug="server"
      category="core"
      fallbackDescription="HTTP kernel for Node.js services: a listener with graceful shutdown, a step pipeline, static file serving with compression and conditional requests, and ordered header rules."
    />
  )
}
