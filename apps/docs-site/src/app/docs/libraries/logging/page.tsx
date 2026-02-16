import { LibraryStubPage } from '@/components/library-stub-page'

export default function LoggingPage() {
  return (
    <LibraryStubPage
      title="Logging"
      packageName="@hyperfrontend/logging"
      description="Production-grade logging abstraction with runtime log level control and error-resilient execution."
      features={[
        'Runtime log level control via setLogLevel() without restarts',
        'Priority-based filtering (error > warn > log > info > debug)',
        'Error-resilient execution prevents logging failures from propagating',
        'Console abstraction accepts any console-like interface',
        'Frozen, immutable logger instances',
      ]}
    />
  )
}
