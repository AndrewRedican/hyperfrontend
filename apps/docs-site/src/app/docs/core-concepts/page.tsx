import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { DocsContentWrapper } from '@/components/docs-content-wrapper'
import { H1, H2 } from '@/components/heading-with-anchor'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Core Concepts',
  description: 'Understand hyperfrontend fundamentals: features, host applications, communication patterns, and iframe-based isolation.',
}

export default function CoreConceptsPage() {
  return (
    <DocsContentWrapper>
      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Core Concepts</H1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Understand the fundamental building blocks of HyperFrontend architecture.
      </p>

      {/* Features */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Features</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          A <strong className="text-slate-900 dark:text-white">feature</strong> is a self-contained micro-frontend that runs in isolation.
          Each feature bundles its own framework, dependencies, and assets. Features communicate with their host through a standardized
          messaging protocol.
        </p>
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/50">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Key insight:</strong> Features are independent deployables. Update one without touching others.
          </p>
        </div>
      </section>

      {/* Host Applications */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Host Applications</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          A <strong className="text-slate-900 dark:text-white">host</strong> (or shell) is the parent application that loads and
          orchestrates features. The host manages feature lifecycle, routes messages, and provides shared context like authentication.
        </p>
        <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400">
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>Dynamically loads features at runtime</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>Manages feature positioning (inline, modal, popout)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>Handles graceful degradation if features fail</span>
          </li>
        </ul>
      </section>

      {/* Contracts */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Contracts</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          <strong className="text-slate-900 dark:text-white">Contracts</strong> define the messages a feature can send and receive. They
          specify <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">emitted</code>{' '}
          actions (messages this context sends) and{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">accepted</code> actions
          (messages this context receives), with optional JSON Schema validation.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
          <div className="border-b border-slate-700 px-4 py-2">
            <span className="text-xs text-slate-400">contract.ts</span>
          </div>
          <pre className="overflow-x-auto p-4">
            <code className="text-sm text-slate-100">{`const contract = {
  emitted: [
    { type: 'CONFIG', schema: configSchema },
    { type: 'NAVIGATION' }
  ],
  accepted: [
    { type: 'READY', schema: readySchema },
    { type: 'DATA', schema: dataSchema }
  ]
}`}</code>
          </pre>
        </div>
      </section>

      {/* Channels */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Channels</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          A <strong className="text-slate-900 dark:text-white">channel</strong> is a bidirectional communication pipe between a host and a
          feature. Channels provide reliable message delivery with ordering guarantees.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h4 className="font-semibold text-slate-900 dark:text-white">Host Side</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>• Creates channels for each feature</li>
              <li>• Subscribes to feature events</li>
              <li>• Sends commands to features</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h4 className="font-semibold text-slate-900 dark:text-white">Feature Side</h4>
            <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>• Connects to provided channel</li>
              <li>• Emits events to host</li>
              <li>• Handles incoming commands</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Isolation */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Isolation Model</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Features typically run in separate browser contexts (iframes, windows, or web workers) with{' '}
          <strong className="text-slate-900 dark:text-white">strict isolation</strong>:
        </p>
        <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400">
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>
              <strong>CSS isolation:</strong> Styles don&apos;t leak between features
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>
              <strong>JavaScript isolation:</strong> Separate global scope per feature
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>
              <strong>Security isolation:</strong> Features can&apos;t access host DOM or data
            </span>
          </li>
        </ul>
      </section>

      {/* Architecture Diagram Placeholder */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <H2 className="text-lg font-bold text-slate-900 dark:text-white">Architecture Overview</H2>
        <div className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 dark:border-slate-600 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            See the full{' '}
            <Link href="/architecture" className="text-primary-600 hover:underline dark:text-primary-400">
              Architecture Guide
            </Link>{' '}
            for detailed diagrams.
          </p>
        </div>
      </section>

      {/* Next Steps */}
      <section className="mt-12">
        <H2 className="text-lg font-bold text-slate-900 dark:text-white">Continue Learning</H2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href="/docs/libraries/nexus"
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
          >
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              @hyperfrontend/nexus
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">The core communication library.</p>
          </Link>
          <Link
            href="/demos"
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
          >
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              Live Demos
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">See these concepts in action.</p>
          </Link>
        </div>
      </section>
    </DocsContentWrapper>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}
