import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'linter',
    packageName: '@hyperfrontend/linter',
    submodulePath: 'helpers',
    path: '/docs/libraries/linter/helpers/',
  })
}

export default function HelpersPage() {
  return <SubmoduleDocPage librarySlug="linter" packageName="@hyperfrontend/linter" submodulePath="helpers" />
}
