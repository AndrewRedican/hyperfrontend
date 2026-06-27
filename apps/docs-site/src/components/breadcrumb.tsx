'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const pathLabels: Record<string, string> = {
  docs: 'Documentation',
  libraries: 'Libraries',
  api: 'API Reference',
  contributing: 'Contributing',
  'quick-start': 'Quick Start',
  'core-concepts': 'Core Concepts',
  architecture: 'Architecture',
  nexus: '@hyperfrontend/nexus',
  'network-protocol': '@hyperfrontend/network-protocol',
  cryptography: '@hyperfrontend/cryptography',
  'state-machine': '@hyperfrontend/state-machine',
  'web-worker': '@hyperfrontend/web-worker',
  utils: '@hyperfrontend/utils',
  logging: '@hyperfrontend/logging',
  features: '@hyperfrontend/features',
  'project-scope': '@hyperfrontend/project-scope',
  versioning: '@hyperfrontend/versioning',
}

export function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const label = pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
    const isLast = index === segments.length - 1

    return { href, label, isLast }
  })

  return (
    <nav className="mb-6 text-sm" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Home
          </Link>
        </li>
        {breadcrumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-2">
            <ChevronIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            {crumb.isLast ? (
              <span className="font-medium text-slate-900 dark:text-white">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

type ChevronIconProps = { className?: string }

function ChevronIcon({ className }: ChevronIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
