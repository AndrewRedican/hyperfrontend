import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/string',
    packageName: '@hyperfrontend/string-utils',
    submodulePath: 'browser',
    path: '/docs/libraries/utils/string/browser/',
  })
}

export default function BrowserPage() {
  return <SubmoduleDocPage librarySlug="utils/string" packageName="@hyperfrontend/string-utils" submodulePath="browser" />
}
