import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'builder',
    packageName: '@hyperfrontend/builder',
    submodulePath: 'package/assets',
    path: '/docs/libraries/builder/package/assets/',
  })
}

export default function PackageAssetsPage() {
  return <SubmoduleDocPage librarySlug="builder" packageName="@hyperfrontend/builder" submodulePath="package/assets" />
}
