import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { CodeBlock } from '@/components/code-block'
import { DocsContentWrapper } from '@/components/docs-content-wrapper'
import { H1, H2 } from '@/components/heading-with-anchor'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Getting Started',
  description: 'Set up hyperfrontend and create your first micro-frontend feature in minutes.',
}

export default function DocsPage() {
  return (
    <DocsContentWrapper>
      <Breadcrumb />

      {/* Page Title */}
      <H1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Getting Started</H1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Set up hyperfrontend and create your first micro-frontend feature in minutes.
      </p>

      {/* Prerequisites */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Prerequisites</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Before you begin, ensure you have:</p>
        <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400">
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>Node.js 18+ and npm/yarn/pnpm</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>An existing web application you want to convert into a feature (or a fresh project)</span>
          </li>
        </ul>
      </section>

      {/* Installation */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Installation</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Install the package:</p>
        <CodeBlock language="bash" code="npm install @hyperfrontend/features" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          It bundles <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">@hyperfrontend/nexus</code> and its other direct
          dependencies, so your app takes on no transitive install burden.
        </p>
      </section>

      {/* Creating a Feature */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Creating a Feature</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Initialize an existing application as a hyperfrontend feature:</p>
        <CodeBlock language="bash" code="npx @hyperfrontend/features init" />
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/50">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>What happens:</strong> The CLI scaffolds the hostee glue module into your app and wires it into the entry file,
            alongside a <code>feature.config.*</code> file and a contract that defines the messages your feature can send and receive.
          </p>
        </div>
      </section>

      {/* Building a Shell */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Building a Shell</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Generate a self-contained shell package that any host can install:</p>
        <CodeBlock language="bash" code="npx @hyperfrontend/features build" />
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          The CLI generates the host connector, inlines the contract, bundles direct dependencies, and packs a publishable tarball with
          typed bindings. The host installs one package and takes on no transitive deps.
        </p>
      </section>

      {/* Testing */}
      <section className="mt-12">
        <H2 className="text-2xl font-bold text-slate-900 dark:text-white">Testing Your Feature</H2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">Serve your apps with the debug UI to see how your feature loads:</p>
        <CodeBlock language="bash" code="npx @hyperfrontend/features dev" />
        <p className="mt-4 text-slate-600 dark:text-slate-400">
          This starts one static server per app plus an in-browser debug UI for inspecting host/hostee message traffic, display modes, and
          the security envelope.
        </p>
      </section>

      {/* What's Next */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <H2 className="text-xl font-bold text-slate-900 dark:text-white">What&apos;s Next?</H2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href="/architecture"
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
          >
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              Architecture Guide
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Understand how the libraries compose together.</p>
          </Link>
          <Link
            href="/demos"
            className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
          >
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              Live Demos
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">See hyperfrontend in action with interactive examples.</p>
          </Link>
        </div>
      </section>
    </DocsContentWrapper>
  )
}

type CheckIconProps = { className?: string }

function CheckIcon({ className }: CheckIconProps) {
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
