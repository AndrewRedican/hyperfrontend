import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'server',
    packageName: '@hyperfrontend/server',
    submodulePath: 'environment',
    path: '/docs/libraries/server/environment/',
  })
}

export default function EnvironmentPage() {
  return <SubmoduleDocPage librarySlug="server" packageName="@hyperfrontend/server" submodulePath="environment" />
}
