import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'server',
    packageName: '@hyperfrontend/server',
    submodulePath: 'manifest',
    path: '/docs/libraries/server/manifest/',
  })
}

export default function ManifestPage() {
  return <SubmoduleDocPage librarySlug="server" packageName="@hyperfrontend/server" submodulePath="manifest" />
}
