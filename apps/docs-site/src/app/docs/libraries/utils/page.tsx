import { Breadcrumb } from '@/components/breadcrumb'
import Link from 'next/link'

const utilPackages = [
  {
    name: '@hyperfrontend/data-utils',
    description: 'Data manipulation utilities for transforming and validating data structures.',
    href: '/docs/libraries/utils/data',
  },
  {
    name: '@hyperfrontend/function-utils',
    description: 'Function composition and manipulation utilities for functional programming patterns.',
    href: '/docs/libraries/utils/function',
  },
  {
    name: '@hyperfrontend/immutable-api-utils',
    description: 'Immutable data structure utilities for working with persistent data structures.',
    href: '/docs/libraries/utils/immutable-api',
  },
  {
    name: '@hyperfrontend/json-utils',
    description: 'JSON parsing, serialization, and manipulation utilities with enhanced error handling.',
    href: '/docs/libraries/utils/json',
  },
  {
    name: '@hyperfrontend/list-utils',
    description: 'Array and list manipulation utilities for efficient collection operations.',
    href: '/docs/libraries/utils/list',
  },
  {
    name: '@hyperfrontend/random-generator-utils',
    description: 'Random value generation utilities for testing, simulations, and unique ID creation.',
    href: '/docs/libraries/utils/random-generator',
  },
  {
    name: '@hyperfrontend/string-utils',
    description: 'String manipulation and formatting utilities for text processing.',
    href: '/docs/libraries/utils/string',
  },
  {
    name: '@hyperfrontend/time-utils',
    description: 'Time and date manipulation utilities for working with temporal data.',
    href: '/docs/libraries/utils/time',
  },
  {
    name: '@hyperfrontend/ui-utils',
    description: 'UI and DOM utilities for building interactive user interfaces.',
    href: '/docs/libraries/utils/ui',
  },
]

export default function UtilsIndexPage() {
  return (
    <>
      <Breadcrumb />

      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Utility Libraries</h1>

      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        A collection of focused utility libraries providing common functionality across the Hyperfrontend ecosystem. Each package is
        independently published and can be installed separately.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {utilPackages.map((pkg) => (
          <Link
            key={pkg.name}
            href={pkg.href}
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
          >
            <h3 className="font-mono text-sm font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              {pkg.name}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{pkg.description}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Installation</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Install individual utility packages as needed. Each package is independently versioned and can be installed separately.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
          <pre className="overflow-x-auto p-4">
            <code className="text-sm text-slate-100">npm install @hyperfrontend/data-utils @hyperfrontend/string-utils</code>
          </pre>
        </div>
      </section>
    </>
  )
}
