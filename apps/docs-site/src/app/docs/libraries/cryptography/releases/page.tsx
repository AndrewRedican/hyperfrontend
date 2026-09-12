import type { Metadata } from 'next'
import { LibraryChangelogPage } from '@/components/changelog/library-changelog-page'
import { getChangelogMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getChangelogMetadata('cryptography')
}

export default function CryptographyReleasesPage() {
  return <LibraryChangelogPage packageRoute="/docs/libraries/cryptography" packageName="@hyperfrontend/cryptography" />
}
