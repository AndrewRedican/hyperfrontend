import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/immutable-api',
    packageName: '@hyperfrontend/immutable-api-utils',
    submodulePath: 'built-in-copy/map',
    path: '/docs/libraries/utils/immutable-api/built-in-copy/map/',
  })
}

export default function MapPage() {
  return (
    <SubmoduleDocPage
      librarySlug="utils/immutable-api"
      packageName="@hyperfrontend/immutable-api-utils"
      submodulePath="built-in-copy/map"
    />
  )
}
