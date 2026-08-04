import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'features',
    packageName: '@hyperfrontend/features',
    submodulePath: 'cli',
    path: '/docs/libraries/features/cli/',
  })
}

export default function CliPage() {
  return <SubmoduleDocPage librarySlug="features" packageName="@hyperfrontend/features" submodulePath="cli" />
}
