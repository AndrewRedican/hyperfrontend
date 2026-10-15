import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'testing',
    packageName: '@hyperfrontend/testing',
    submodulePath: 'runner',
    path: '/docs/libraries/testing/runner/',
  })
}

export default function RunnerPage() {
  return <SubmoduleDocPage librarySlug="testing" packageName="@hyperfrontend/testing" submodulePath="runner" />
}
