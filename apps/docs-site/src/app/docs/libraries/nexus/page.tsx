import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('nexus')
}

export default function NexusPage() {
  return (
    <LibraryDocPage
      title="Nexus"
      packageName="@hyperfrontend/nexus"
      slug="nexus"
      category="core"
      fallbackDescription="Secure cross-window communication library for micro-frontends with contract-validated messaging, origin-based security policies, and connection lifecycle management."
      fallbackFeatures={[
        'Broker-channel architecture for message routing across browser contexts',
        'Contract-validated messaging with optional JSON Schema validation',
        'Origin-based security with whitelist/blacklist filtering',
        'Connection lifecycle management (connect, disconnect, cancel, deny)',
        'Support for iframes, windows, tabs, and web workers',
      ]}
    />
  )
}
