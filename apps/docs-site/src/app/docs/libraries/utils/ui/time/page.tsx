import type { Metadata } from 'next'
import { SubmoduleDocPage } from '@/components/submodule-doc-page'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'utils/ui',
    packageName: '@hyperfrontend/ui-utils',
    submodulePath: 'time',
    path: '/docs/libraries/utils/ui/time/',
  })
}

export default function TimePage() {
  return <SubmoduleDocPage librarySlug="utils/ui" packageName="@hyperfrontend/ui-utils" submodulePath="time" />
}
