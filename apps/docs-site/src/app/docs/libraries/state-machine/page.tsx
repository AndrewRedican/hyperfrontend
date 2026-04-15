import type { Metadata } from 'next'
import { LibraryDocPage } from '@/components/library-doc-page'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('state-machine')
}

export default function StateMachinePage() {
  return (
    <LibraryDocPage
      title="State Machine"
      packageName="@hyperfrontend/state-machine"
      slug="state-machine"
      category="core"
      fallbackDescription="Tiny finite state machine implementation with context-aware transitions, invokable services, and declarative configuration."
      fallbackFeatures={[
        'State definitions with enter, exit, and activity handlers',
        'Transition guards with context-aware conditions',
        'Transition actions for side effects during state changes',
        'Invokable async services with callback adapters',
        'Event-driven API with type-safe state/event definitions',
      ]}
    />
  )
}
