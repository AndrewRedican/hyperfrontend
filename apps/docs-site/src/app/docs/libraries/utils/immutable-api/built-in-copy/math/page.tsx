import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/immutable-api',
    packageName: '@hyperfrontend/immutable-api-utils',
    submodulePath: 'built-in-copy/math',
    path: '/docs/libraries/utils/immutable-api/built-in-copy/math/',
  })
}

export default function MathPage() {
  return (
    <SubmoduleDocPage
      librarySlug="utils/immutable-api"
      packageName="@hyperfrontend/immutable-api-utils"
      submodulePath="built-in-copy/math"
    />
  )
}
