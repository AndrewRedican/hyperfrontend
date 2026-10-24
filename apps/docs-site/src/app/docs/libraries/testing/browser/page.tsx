import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'testing',
    packageName: '@hyperfrontend/testing',
    submodulePath: 'browser',
    path: '/docs/libraries/testing/browser/',
  })
}

export default function BrowserPage() {
  return <SubmoduleDocPage librarySlug="testing" packageName="@hyperfrontend/testing" submodulePath="browser" />
}
