import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'registry/npm',
    path: '/docs/libraries/versioning/registry/npm/',
  })
}

export default function NpmPage() {
  return <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="registry/npm" />
}
