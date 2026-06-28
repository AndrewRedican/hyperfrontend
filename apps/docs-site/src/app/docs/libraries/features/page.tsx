import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('features')
}

export default function FeaturesPage() {
  return (
    <LibraryDocPage
      title="Features"
      packageName="@hyperfrontend/features"
      slug="features"
      category="core"
      fallbackDescription="SDK, CLI, and dev server for building, embedding, and orchestrating hyperfrontend micro-frontend features."
      fallbackFeatures={[
        'Host-side SDK for embedding features with display modes and lifecycle',
        'Hostee-side SDK for feature apps, including contract declaration',
        'CLI for initializing, building, and serving features',
        'Dev server with a debug UI for inspecting host/hostee message traffic',
        'Zero-config dependency bundling so generated shells stay self-contained',
        'Works with any framework and build tool, plus optional Nx generators and executors',
      ]}
    />
  )
}
