import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'testing',
    packageName: '@hyperfrontend/testing',
    submodulePath: 'dom',
    path: '/docs/libraries/testing/dom/',
  })
}

export default function DomPage() {
  return <SubmoduleDocPage librarySlug="testing" packageName="@hyperfrontend/testing" submodulePath="dom" />
}
