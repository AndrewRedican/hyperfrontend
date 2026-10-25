import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'testing',
    packageName: '@hyperfrontend/testing',
    submodulePath: 'consumer',
    path: '/docs/libraries/testing/consumer/',
  })
}

export default function ConsumerPage() {
  return <SubmoduleDocPage librarySlug="testing" packageName="@hyperfrontend/testing" submodulePath="consumer" />
}
