import { LibraryStubPage } from '@/components/library-stub-page'

export default function StateMachinePage() {
  return (
    <LibraryStubPage
      title="State Machine"
      packageName="@hyperfrontend/state-machine"
      description="Lightweight, functional state management library with Redux-inspired actions/reducers, async operation orchestration, and lifecycle-aware component abstractions."
      features={[
        'Redux-style Store with subscribe/dispatch APIs',
        'Pre-built process reducer (start, pause, cancel, success, fail)',
        'AsyncOperation wrapper for automatic state transitions',
        'LifecycleAwareComponent for initialization workflows',
        'Event-driven notifications on derived state changes',
      ]}
    />
  )
}
