import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'cryptography',
    packageName: '@hyperfrontend/cryptography',
    submodulePath: 'browser',
    path: '/docs/libraries/cryptography/browser/',
  })
}

export default function BrowserPage() {
  return <SubmoduleDocPage librarySlug="cryptography" packageName="@hyperfrontend/cryptography" submodulePath="browser" />
}
