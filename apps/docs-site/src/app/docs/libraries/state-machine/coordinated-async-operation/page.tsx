import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'state-machine',
    packageName: '@hyperfrontend/state-machine',
    submodulePath: 'coordinated-async-operation',
    path: '/docs/libraries/state-machine/coordinated-async-operation/',
  })
}

export default function CoordinatedAsyncOperationPage() {
  return (
    <SubmoduleDocPage librarySlug="state-machine" packageName="@hyperfrontend/state-machine" submodulePath="coordinated-async-operation" />
  )
}
