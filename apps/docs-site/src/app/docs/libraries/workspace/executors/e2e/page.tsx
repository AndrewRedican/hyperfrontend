import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'workspace',
    packageName: '@hyperfrontend/workspace',
    submodulePath: 'executors/e2e',
    path: '/docs/libraries/workspace/executors/e2e/',
  })
}

export default function ExecutorsE2ePage() {
  return <SubmoduleDocPage librarySlug="workspace" packageName="@hyperfrontend/workspace" submodulePath="executors/e2e" />
}
