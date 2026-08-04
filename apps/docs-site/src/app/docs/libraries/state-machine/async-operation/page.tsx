import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'state-machine',
    packageName: '@hyperfrontend/state-machine',
    submodulePath: 'async-operation',
    path: '/docs/libraries/state-machine/async-operation/',
  })
}

export default function AsyncOperationPage() {
  return <SubmoduleDocPage librarySlug="state-machine" packageName="@hyperfrontend/state-machine" submodulePath="async-operation" />
}
