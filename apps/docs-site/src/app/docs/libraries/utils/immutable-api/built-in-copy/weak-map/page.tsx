import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/immutable-api',
    packageName: '@hyperfrontend/immutable-api-utils',
    submodulePath: 'built-in-copy/weak-map',
    path: '/docs/libraries/utils/immutable-api/built-in-copy/weak-map/',
  })
}

export default function WeakMapPage() {
  return (
    <SubmoduleDocPage
      librarySlug="utils/immutable-api"
      packageName="@hyperfrontend/immutable-api-utils"
      submodulePath="built-in-copy/weak-map"
    />
  )
}
