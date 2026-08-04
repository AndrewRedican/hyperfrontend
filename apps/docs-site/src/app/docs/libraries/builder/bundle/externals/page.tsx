import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'builder',
    packageName: '@hyperfrontend/builder',
    submodulePath: 'bundle/externals',
    path: '/docs/libraries/builder/bundle/externals/',
  })
}

export default function BundleExternalsPage() {
  return <SubmoduleDocPage librarySlug="builder" packageName="@hyperfrontend/builder" submodulePath="bundle/externals" />
}
