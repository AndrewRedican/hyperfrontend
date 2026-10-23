import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'linter',
    packageName: '@hyperfrontend/linter',
    submodulePath: 'testing',
    path: '/docs/libraries/linter/testing/',
  })
}

export default function TestingPage() {
  return <SubmoduleDocPage librarySlug="linter" packageName="@hyperfrontend/linter" submodulePath="testing" />
}
