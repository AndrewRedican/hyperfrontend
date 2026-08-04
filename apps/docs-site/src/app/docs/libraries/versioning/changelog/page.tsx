import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'changelog',
    path: '/docs/libraries/versioning/changelog/',
  })
}

export default function ChangelogPage() {
  return <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="changelog" />
}
