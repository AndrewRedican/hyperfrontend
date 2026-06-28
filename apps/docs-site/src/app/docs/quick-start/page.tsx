import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { CodeBlock } from '@/components/code-block'
import { DocsContentWrapper } from '@/components/docs-content-wrapper'
import { H1, H2 } from '@/components/heading-with-anchor'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Quick Start',
  description: 'Get a micro-frontend feature running in under 5 minutes with step-by-step setup guide.',
}

export default function QuickStartPage() {
  return (
    <DocsContentWrapper>
      <Breadcrumb />

      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Quick Start</H1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Get a micro-frontend feature running in under 5 minutes.</p>

      {/* Step 1 */}
      <section className="mt-12">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            1
          </span>
          <H2 id="install-the-package" className="text-2xl font-bold text-slate-900 dark:text-white">
            Install the package
          </H2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">Add the package to your project:</p>
          <CodeBlock code="npm install @hyperfrontend/features" />
        </div>
      </section>

      {/* Step 2 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            2
          </span>
          <H2 id="initialize-a-feature" className="text-2xl font-bold text-slate-900 dark:text-white">
            Initialize a feature
          </H2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">Convert an existing application into a HyperFrontend feature:</p>
          <CodeBlock code="npx @hyperfrontend/features init" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            This scaffolds the hostee glue module into your app and wires it into the entry file, alongside your feature contract.
          </p>
        </div>
      </section>

      {/* Step 3 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            3
          </span>
          <H2 id="build-a-shell" className="text-2xl font-bold text-slate-900 dark:text-white">
            Build a shell
          </H2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">Generate a self-contained shell package that any host can install:</p>
          <CodeBlock code="npx @hyperfrontend/features build" />
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            The shell inlines the contract and bundles its dependencies, so the host installs one package and takes on no transitive deps.
          </p>
        </div>
      </section>

      {/* Step 4 */}
      <section className="mt-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
            4
          </span>
          <H2 id="run-it" className="text-2xl font-bold text-slate-900 dark:text-white">
            Run it
          </H2>
        </div>
        <div className="mt-4 pl-11">
          <p className="text-slate-600 dark:text-slate-400">Serve your apps with the debug UI and watch the feature load:</p>
          <CodeBlock code="npx @hyperfrontend/features dev" />
        </div>
      </section>

      {/* Next Steps */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <H2 className="text-xl font-bold text-slate-900 dark:text-white">Next Steps</H2>
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
    </DocsContentWrapper>
  )
}
