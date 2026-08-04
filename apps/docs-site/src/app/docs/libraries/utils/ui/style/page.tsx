import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/ui',
    packageName: '@hyperfrontend/ui-utils',
    submodulePath: 'style',
    path: '/docs/libraries/utils/ui/style/',
  })
}

export default function StylePage() {
  return <SubmoduleDocPage librarySlug="utils/ui" packageName="@hyperfrontend/ui-utils" submodulePath="style" />
}
