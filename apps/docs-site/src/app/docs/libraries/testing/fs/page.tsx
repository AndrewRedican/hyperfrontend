import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'testing',
    packageName: '@hyperfrontend/testing',
    submodulePath: 'fs',
    path: '/docs/libraries/testing/fs/',
  })
}

export default function FsPage() {
  return <SubmoduleDocPage librarySlug="testing" packageName="@hyperfrontend/testing" submodulePath="fs" />
}
