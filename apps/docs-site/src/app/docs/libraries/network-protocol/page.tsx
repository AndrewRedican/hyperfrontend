import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('network-protocol')
}

export default function NetworkProtocolPage() {
  return (
    <LibraryDocPage
      title="Network Protocol"
      packageName="@hyperfrontend/network-protocol"
      slug="network-protocol"
      category="core"
      fallbackDescription="Binary-efficient message protocol supporting both JSON and direct ArrayBuffer transmission with built-in heartbeat monitoring for reliable real-time communication."
      fallbackFeatures={[
        'Binary message encoding with DataView-based serialization',
        'Support for JSON payloads and direct ArrayBuffer transmission',
        'Sequence numbering and acknowledgment system',
        'Built-in heartbeat monitoring for connection health',
        'Message types: CONNECT, DATA, ACK, HEARTBEAT, ERROR, DISCONNECT',
      ]}
    />
  )
}
