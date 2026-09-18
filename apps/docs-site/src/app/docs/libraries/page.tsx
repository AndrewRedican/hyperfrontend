import { getAllLibraryData } from '@/lib/docs-loader'
import { getPageMetadata } from '@/lib/metadata'
import { LibrariesPageContent } from './libraries-page-content'

export const metadata = getPageMetadata({
  title: 'Libraries',
  description:
    'The HyperFrontend package ecosystem, from the features SDK down to the messaging, build, and utility packages underneath it.',
  path: '/docs/libraries/',
})

export default function LibrariesPage() {
  return <LibrariesPageContent libraries={getAllLibraryData()} />
}
