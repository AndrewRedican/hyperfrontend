import { Breadcrumb } from '@/components/breadcrumb'

export default function ContributingPage() {
  return (
    <>
      <Breadcrumb />

      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Contributing</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Thank you for your interest in contributing to HyperFrontend! This guide will help you get started.
      </p>

      {/* Quick Links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a
          href="https://github.com/AndrewRedican/hyperfrontend"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
        >
          <GitHubIcon className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              GitHub Repository
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">View source and open issues</p>
          </div>
        </a>
        <a
          href="https://github.com/AndrewRedican/hyperfrontend/blob/main/CONTRIBUTING.md"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
        >
          <DocumentIcon className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
              Full Guidelines
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Complete contribution guide</p>
          </div>
        </a>
      </div>

      {/* Getting Started */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Getting Started</h2>
        <ol className="mt-4 space-y-4 text-slate-600 dark:text-slate-400">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              1
            </span>
            <div>
              <strong className="text-slate-900 dark:text-white">Fork the repository</strong>
              <p className="mt-1">
                Create your own fork of{' '}
                <a href="https://github.com/AndrewRedican/hyperfrontend" className="text-primary-600 hover:underline dark:text-primary-400">
                  hyperfrontend
                </a>{' '}
                on GitHub.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              2
            </span>
            <div>
              <strong className="text-slate-900 dark:text-white">Clone and install</strong>
              <CodeBlock
                code="git clone https://github.com/YOUR_USERNAME/hyperfrontend.git&#10;cd hyperfrontend&#10;npm install"
              />
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              3
            </span>
            <div>
              <strong className="text-slate-900 dark:text-white">Create a branch</strong>
              <CodeBlock code="git checkout -b feat/your-feature-name" />
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              4
            </span>
            <div>
              <strong className="text-slate-900 dark:text-white">Make your changes</strong>
              <p className="mt-1">Write your code, add tests, and ensure all checks pass.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              5
            </span>
            <div>
              <strong className="text-slate-900 dark:text-white">Submit a pull request</strong>
              <p className="mt-1">Open a PR against the main branch with a clear description of your changes.</p>
            </div>
          </li>
        </ol>
      </section>

      {/* Development Commands */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Development Commands</h2>
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Run tests</h3>
            <CodeBlock code="npx nx run-many -t test" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Run linting</h3>
            <CodeBlock code="npx nx run-many -t lint" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Build all packages</h3>
            <CodeBlock code="npx nx run-many -t build" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Run a specific demo</h3>
            <CodeBlock code="npx nx serve chess" />
          </div>
        </div>
      </section>

      {/* Code Style */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Code Style</h2>
        <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400">
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>Follow existing code conventions and patterns</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>
              Use{' '}
              <a
                href="https://www.conventionalcommits.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline dark:text-primary-400"
              >
                Conventional Commits
              </a>{' '}
              for commit messages
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>Add tests for new functionality</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
            <span>Update documentation as needed</span>
          </li>
        </ul>
      </section>

      {/* CLA */}
      <section className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
        <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200">Contributor License Agreement</h2>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
          By contributing to HyperFrontend, you agree to our{' '}
          <a
            href="https://github.com/AndrewRedican/hyperfrontend/blob/main/CLA.md"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Contributor License Agreement
          </a>
          . This ensures we can continue to distribute the project under its license.
        </p>
      </section>

      {/* Questions */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Questions?</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          If you have questions or need help, feel free to{' '}
          <a
            href="https://github.com/AndrewRedican/hyperfrontend/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline dark:text-primary-400"
          >
            start a discussion
          </a>{' '}
          on GitHub.
        </p>
      </section>
    </>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
      <pre className="overflow-x-auto p-4">
        <code className="text-sm text-slate-100">{code}</code>
      </pre>
    </div>
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function DocumentIcon({ className }: { className?: string }) {
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
