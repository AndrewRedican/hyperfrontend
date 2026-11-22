import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'server',
    packageName: '@hyperfrontend/server',
    submodulePath: 'policy',
    path: '/docs/libraries/server/policy/',
  })
}

export default function PolicyPage() {
  return <SubmoduleDocPage librarySlug="server" packageName="@hyperfrontend/server" submodulePath="policy" />
}
