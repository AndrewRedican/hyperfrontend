import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'builder',
    packageName: '@hyperfrontend/builder',
    submodulePath: 'package/json',
    path: '/docs/libraries/builder/package/json/',
  })
}

export default function PackageJsonPage() {
  return <SubmoduleDocPage librarySlug="builder" packageName="@hyperfrontend/builder" submodulePath="package/json" />
}
