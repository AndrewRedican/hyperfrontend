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
      fallbackDescription="A small HTTP kernel for Node.js: a service is a list of steps that return responses, run as a process with fixed exit codes, one started line and a graceful stop."
    />
  )
}
