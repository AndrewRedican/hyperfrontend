import { Breadcrumb } from '@/components/breadcrumb'
import Link from 'next/link'

export default function QuickStartPage() {
  return (
    <>
      <Breadcrumb />

      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Quick Start</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Get a micro-frontend feature running in under 5 minutes.</p>

      {/* Step 1 */}
      <section className="mt-12">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            1
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add the plugin</h2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">In your Nx workspace, install the HyperFrontend plugin:</p>
          <CodeBlock code="npx nx add @hyperfrontend/features" />
        </div>
      </section>

      {/* Step 2 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            2
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Initialize a feature</h2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">Convert an existing application into a HyperFrontend feature:</p>
          <CodeBlock code="npx nx g @hyperfrontend/features:init --project=my-app" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">This creates your feature configuration and contract schemas.</p>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            3
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add to a host</h2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">Integrate the feature into your host application:</p>
          <CodeBlock code="npx nx g @hyperfrontend/features:add --feature=my-app --host=my-shell" />
        </div>
      </section>

      {/* Step 4 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            4
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Run it</h2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">Start your host application and see the feature load:</p>
          <CodeBlock code="npx nx serve my-shell" />
        </div>
      </section>

      {/* Next Steps */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Next Steps</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href="/docs/core-concepts"
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
          >
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              Core Concepts
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Understand the architecture fundamentals.</p>
          </Link>
          <Link
            href="/docs/libraries/nexus"
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
          >
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              Nexus Library
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Deep dive into the messaging API.</p>
          </Link>
        </div>
      </section>
    </>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
      <pre className="overflow-x-auto p-4">
        <code className="text-sm text-slate-100">{code}</code>
      </pre>
    </div>
  )
}
