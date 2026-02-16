import { LibraryStubPage } from '@/components/library-stub-page'

export default function FeaturesPluginPage() {
  return (
    <LibraryStubPage
      title="Features Plugin"
      packageName="@hyperfrontend/features"
      description="The Nx plugin for generating, configuring, and managing hyperfrontend features within your monorepo."
      features={[
        'Project initialization generator',
        'Feature scaffolding with contract templates',
        'Host application integration generator',
        'Contract synchronization and code generation',
        'Playground host for isolated development',
      ]}
    />
  )
}
