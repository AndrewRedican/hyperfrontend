import { LibraryStubPage } from '@/components/library-stub-page'

export default function WebWorkerPage() {
  return (
    <LibraryStubPage
      title="Web Worker"
      packageName="@hyperfrontend/web-worker"
      description="Web Worker utilities and abstractions for offloading work to background threads."
      features={[
        'Worker creation and management utilities',
        'Message passing abstractions',
        'Lifecycle management',
        'Integration with HyperFrontend ecosystem',
      ]}
    />
  )
}
