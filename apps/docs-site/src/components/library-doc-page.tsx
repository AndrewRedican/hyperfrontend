import type { TypeDocOutput } from '@/components/api-reference'
import { ApiReference } from '@/components/api-reference'
import { Breadcrumb } from '@/components/breadcrumb'
import { removeBadges, transformLinks } from '@/lib/content'
import { getLibraryReadme, getLibraryArchitecture, getLibraryApi } from '@/lib/docs-loader'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import Link from 'next/link'
import { ReadmeContent } from './readme-content'

interface LibraryPageProps {
  title: string
  packageName: string
  slug: string
  category: 'core' | 'supporting' | 'utils' | 'plugin'
  fallbackDescription?: string
  fallbackFeatures?: string[]
}

export async function LibraryDocPage({ title, packageName, slug, fallbackDescription, fallbackFeatures }: LibraryPageProps) {
  const readme = getLibraryReadme(slug)
  const hasArchitecture = !!getLibraryArchitecture(slug)
  const apiData = getLibraryApi(slug) as TypeDocOutput | null

  if (readme) {
    let processed = removeBadges(readme)
    processed = transformLinks(processed)

    const { processedContent, diagrams } = extractMermaidBlocks(processed)

    const html = await markdownToHtml(processedContent)

    return (
      <>
        <Breadcrumb />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {packageName}
          </code>
          <a
            href={`https://www.npmjs.com/package/${packageName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:underline dark:text-primary-400"
          >
            View on npm →
          </a>
          {hasArchitecture && (
            <Link href={`/docs/libraries/${slug}/architecture`} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
              Architecture →
            </Link>
          )}
        </div>

        <ReadmeContent html={html} mermaidDiagrams={diagrams} />

        {/* API Reference */}
        {apiData && (
          <section className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">API Reference</h2>
            <ApiReference data={apiData} />
          </section>
        )}

        {/* Related Links */}
        <section className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Related</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href="/docs"
              className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
            >
              <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                Getting Started
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Learn how to set up hyperfrontend.</p>
            </Link>
            <Link
              href="/architecture"
              className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
            >
              <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                Architecture Guide
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Understand how the libraries work together.</p>
            </Link>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <Breadcrumb />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
        <DocumentationIcon className="h-4 w-4" />
        Documentation coming soon
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>

      <div className="mt-4 flex items-center gap-3">
        <code className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {packageName}
        </code>
        <a
          href={`https://www.npmjs.com/package/${packageName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 hover:underline dark:text-primary-400"
        >
          View on npm →
        </a>
      </div>

      {fallbackDescription && <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">{fallbackDescription}</p>}

      {fallbackFeatures && fallbackFeatures.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Key Features</h2>
          <ul className="mt-4 space-y-2">
            {fallbackFeatures.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Install</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-900 dark:border-slate-700">
          <pre className="overflow-x-auto p-4">
            <code className="text-sm text-slate-100">npm install {packageName}</code>
          </pre>
        </div>
      </section>
    </>
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
