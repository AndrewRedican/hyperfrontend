import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/format',
    path: '/docs/libraries/versioning/commits/format/',
  })
}

export default function FormatPage() {
  return <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="commits/format" />
}
