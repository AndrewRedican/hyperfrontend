import { LibraryDocPage } from '@/components/library-doc-page'

export default function LoggingPage() {
  return (
    <LibraryDocPage
      title="Logging"
      packageName="@hyperfrontend/logging"
      slug="logging"
      category="core"
      fallbackDescription="Extensible logging framework with pluggable transports for capturing and routing log messages across different output channels."
      fallbackFeatures={[
        'Stream-based architecture with transformer and transmitter chains',
        'Configurable log levels (debug, info, warn, error)',
        'Built-in transports: Console, IndexedDB (async batching), HTTP',
        'Custom transformer and transmitter support',
        'LogRecord interface with timestamp, context, and metadata',
      ]}
    />
  )
}
