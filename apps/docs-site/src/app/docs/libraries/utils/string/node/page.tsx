import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/string',
    packageName: '@hyperfrontend/string-utils',
    submodulePath: 'node',
    path: '/docs/libraries/utils/string/node/',
  })
}

export default function NodePage() {
  return <SubmoduleDocPage librarySlug="utils/string" packageName="@hyperfrontend/string-utils" submodulePath="node" />
}
