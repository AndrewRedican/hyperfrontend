import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('cryptography')
}

export default function CryptographyPage() {
  return (
    <LibraryDocPage
      title="Cryptography"
      packageName="@hyperfrontend/cryptography"
      slug="cryptography"
      category="core"
      fallbackDescription="Lightweight cryptographic primitives for secure client-side communication using RSA-OAEP encryption and RSASSA-PKCS1-v1_5 signatures powered by the Web Crypto API."
      fallbackFeatures={[
        'RSA-OAEP encryption with SHA-256 for secure message exchange',
        'RSASSA-PKCS1-v1_5 digital signatures for message verification',
        'Key pair generation with configurable modulus length (2048-4096 bits)',
        'JSON Web Key (JWK) export/import for interoperability',
        'Web Crypto API backend for native browser performance',
      ]}
    />
  )
}
