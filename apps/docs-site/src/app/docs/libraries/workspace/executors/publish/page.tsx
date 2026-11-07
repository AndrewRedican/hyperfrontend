import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'workspace',
    packageName: '@hyperfrontend/workspace',
    submodulePath: 'executors/publish',
    path: '/docs/libraries/workspace/executors/publish/',
  })
}

export default function ExecutorsPublishPage() {
  return <SubmoduleDocPage librarySlug="workspace" packageName="@hyperfrontend/workspace" submodulePath="executors/publish" />
}
