import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'workspace',
    packageName: '@hyperfrontend/workspace',
    submodulePath: 'cli',
    path: '/docs/libraries/workspace/cli/',
  })
}

export default function CliPage() {
  return <SubmoduleDocPage librarySlug="workspace" packageName="@hyperfrontend/workspace" submodulePath="cli" />
}
