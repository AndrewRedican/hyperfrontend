import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/parse',
    path: '/docs/libraries/versioning/commits/parse/',
  })
}

export default function ParsePage() {
  return <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="commits/parse" />
}
