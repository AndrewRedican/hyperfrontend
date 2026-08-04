import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'cryptography',
    packageName: '@hyperfrontend/cryptography',
    submodulePath: 'common',
    path: '/docs/libraries/cryptography/common/',
  })
}

export default function CommonPage() {
  return <SubmoduleDocPage librarySlug="cryptography" packageName="@hyperfrontend/cryptography" submodulePath="common" />
}
