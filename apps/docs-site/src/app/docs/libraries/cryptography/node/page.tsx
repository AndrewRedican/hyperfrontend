import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'cryptography',
    packageName: '@hyperfrontend/cryptography',
    submodulePath: 'node',
    path: '/docs/libraries/cryptography/node/',
  })
}

export default function NodePage() {
  return <SubmoduleDocPage librarySlug="cryptography" packageName="@hyperfrontend/cryptography" submodulePath="node" />
}
