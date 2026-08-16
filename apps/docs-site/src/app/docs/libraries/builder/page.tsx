import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('builder')
}

export default function BuilderPage() {
  return (
    <LibraryDocPage
      title="Builder"
      packageName="@hyperfrontend/builder"
      slug="builder"
      category="core"
      fallbackDescription="Composable, vendor-neutral build toolkit for TypeScript libraries, JS bins, and Node SEA native binaries."
      fallbackFeatures={[
        'Build TypeScript libraries to ESM, CJS, IIFE, and UMD with per-entry isolation',
        'Synthesize JS bins and cross-platform Node SEA native binaries',
        'Predicate-driven extension model for classifying externals and assets',
        'Dependency bundling with first-party deduplication and license collection',
        'Memory-aware pipeline that recovers gracefully under constrained environments',
        'Programmatic API plus an `hf-build` command-line entry point',
        'Composable phases (bundle, package, and bin) usable independently or together',
      ]}
    />
  )
}
