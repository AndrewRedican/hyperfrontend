import type { Metadata } from 'next'
import { getAllLibraryData } from '@/lib/docs-loader'
import { LibrariesPageContent } from './libraries-page-content'

export const metadata: Metadata = {
  title: 'Libraries',
  description:
    'The HyperFrontend package ecosystem, from the features SDK down to the messaging, build, and utility packages underneath it.',
}

export default function LibrariesPage() {
  return <LibrariesPageContent libraries={getAllLibraryData()} />
}
