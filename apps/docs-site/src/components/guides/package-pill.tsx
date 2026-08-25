import { shortPackageName } from '@/lib/guide-labels'
import Link from 'next/link'

type IconProps = { className?: string }

interface PackagePillProps {
  /** Full npm package name; the shared npm scope is dropped from the label */
  packageName: string
  /** Where clicking the pill takes the reader */
  href: string
  /** Whether this package is the view's active filter */
  active?: boolean
  /** How many guides involve the package; omitted where the pill names a package rather than offering a filter */
  count?: number
}

/**
 * A package as a filter you can click: the npm package a guide involves,
 * shown without the scope every HyperFrontend package shares, carrying a box
 * glyph so it reads as a package rather than as the guide's type or status.
 *
 * It is a link rather than a button so it can be opened in a new tab, and so
 * a package's guides stay reachable by following the page.
 * @param props - Component props
 * @param props.packageName - Full npm package name
 * @param props.href - Where clicking the pill takes the reader
 * @param props.active - Whether this package is the view's active filter
 * @param props.count - How many guides involve the package
 * @returns The rendered package pill
 */
export function PackagePill({ packageName, href, active = false, count }: PackagePillProps) {
  return (
    <Link
      href={href}
      title={packageName}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 font-mono text-xs transition-colors ${
        active
          ? 'bg-primary-600 text-white dark:bg-primary-500'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
      }`}
    >
      <PackageIcon className="h-3 w-3 opacity-70" />
      {shortPackageName(packageName)}
      {count === undefined ? null : <span className="opacity-60">{count}</span>}
    </Link>
  )
}

function PackageIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
      />
    </svg>
  )
}
