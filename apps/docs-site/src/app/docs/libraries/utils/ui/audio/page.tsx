import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/ui',
    packageName: '@hyperfrontend/ui-utils',
    submodulePath: 'audio',
    path: '/docs/libraries/utils/ui/audio/',
  })
}

export default function AudioPage() {
  return <SubmoduleDocPage librarySlug="utils/ui" packageName="@hyperfrontend/ui-utils" submodulePath="audio" />
}
