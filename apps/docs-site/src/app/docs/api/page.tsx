import { Breadcrumb } from '@/components/breadcrumb'
import Link from 'next/link'

export default function ApiReferencePage() {
  return (
    <>
      <Breadcrumb />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
        <DocumentationIcon className="h-4 w-4" />
        API documentation coming soon
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">API Reference</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Complete API documentation for all HyperFrontend packages. Generated from TypeScript source.
      </p>

      {/* API Sections */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Core Libraries</h2>
        <div className="mt-6 grid gap-4">
          <ApiCard
            title="@hyperfrontend/nexus"
            description="Broker-channel messaging with contracts and lifecycle management"
            href="/docs/libraries/nexus"
            modules={['createBroker', 'createChannel', 'byType', 'compose', 'IChannelContract']}
          />
          <ApiCard
            title="@hyperfrontend/network-protocol"
            description="Secure message transport with encryption and queue-based processing"
            href="/docs/libraries/network-protocol"
            modules={['createChannel', 'ProtocolProvider', 'Queue', 'Routing']}
          />
          <ApiCard
            title="@hyperfrontend/cryptography"
            description="AES-GCM encryption, PBKDF2 key derivation, and secure vaults"
            href="/docs/libraries/cryptography"
            modules={['encrypt', 'decrypt', 'createVault', 'createHash', 'getTimeBasedPasswords']}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Supporting Libraries</h2>
        <div className="mt-6 grid gap-4">
          <ApiCard
            title="@hyperfrontend/state-machine"
            description="Redux-inspired state management with async operation support"
            href="/docs/libraries/state-machine"
            modules={['Store', 'rootReducer', 'AsyncOperation', 'LifecycleAwareComponent']}
          />
          <ApiCard
            title="@hyperfrontend/web-worker"
            description="Web Worker utilities and abstractions"
            href="/docs/libraries/web-worker"
            modules={['Worker', 'MessageHandler']}
          />
          <ApiCard
            title="@hyperfrontend/logging"
            description="Runtime log level control with error-resilient execution"
            href="/docs/libraries/logging"
            modules={['logger', 'createLogger', 'setLogLevel']}
          />
          <ApiCard
            title="@hyperfrontend/utils"
            description="Utility sub-packages for data, string, list, time, and more"
            href="/docs/libraries/utils"
            modules={['data-utils', 'string-utils', 'list-utils', 'time-utils', 'random-generator']}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nx Plugin</h2>
        <div className="mt-6 grid gap-4">
          <ApiCard
            title="@hyperfrontend/features"
            description="Generators and executors for Nx workspaces"
            href="/docs/plugins/features"
            modules={['init', 'add', 'sync', 'serve']}
          />
        </div>
      </section>

      {/* TypeDoc Notice */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Generated Documentation</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Full API documentation is generated from TypeScript JSDoc comments using{' '}
          <a
            href="https://typedoc.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline dark:text-primary-400"
          >
            TypeDoc
          </a>
          . Each package includes inline documentation accessible via your IDE&apos;s IntelliSense.
        </p>
        <div className="mt-4">
          <Link
            href="https://github.com/AndrewRedican/hyperfrontend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            View source on GitHub
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}

function ApiCard({ title, description, href, modules }: { title: string; description: string; href: string; modules: string[] }) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-primary-300 hover:bg-primary-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-mono text-sm font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        <ArrowRightIcon className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary-500" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {modules.map((module) => (
          <span
            key={module}
            className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          >
            {module}
          </span>
        ))}
      </div>
    </Link>
  )
}

function DocumentationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
