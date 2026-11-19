import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'workspace',
    packageName: '@hyperfrontend/workspace',
    submodulePath: 'progress',
    path: '/docs/libraries/workspace/progress/',
  })
}

export default function ProgressPage() {
  return <SubmoduleDocPage librarySlug="workspace" packageName="@hyperfrontend/workspace" submodulePath="progress" />
}
