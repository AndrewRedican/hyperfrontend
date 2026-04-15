import type { Metadata } from 'next'
import { LibrariesPageContent } from './libraries-page-content'

export const metadata: Metadata = {
  title: 'Libraries',
  description: 'Browse the hyperfrontend library ecosystem: nexus, network-protocol, cryptography, state-machine, and utility packages.',
}

export default function LibrariesPage() {
  return <LibrariesPageContent />
}
