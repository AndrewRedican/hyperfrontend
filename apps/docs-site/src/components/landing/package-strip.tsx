'use client'

import { formatExactCount } from '@/lib/downloads-route'
import { useEffect, useRef, useState } from 'react'

/** One package as the strip names it. */
export interface PackagePill {
  /** npm package name */
  name: string
  /** Route to the package's documentation */
  href: string
  /** Whether this is the package the hierarchy opens on */
  flagship: boolean
  /** Tracked npm downloads, or null when none have been collected for it */
  downloads: number | null
}

/** Props for {@link PackageStrip}. */
interface PackageStripProps {
  /** Every published package, in the order the strip shows them */
  packages: readonly PackagePill[]
  /** How many the strip names before offering the rest */
  named: number
}

/**
 * The package pills: the first few on their own, and the rest behind a count
 * that reveals them in place. There is no way to fold them back, and none is
 * needed: a reader who asked for the whole list wants the whole list.
 * @param props - See {@link PackageStripProps}.
 * @param props.packages - Every published package, in order
 * @param props.named - How many the strip names before offering the rest
 * @returns The strip.
 */
export function PackageStrip({ packages, named }: PackageStripProps) {
  const [expanded, setExpanded] = useState(false)
  const firstRevealed = useRef<HTMLAnchorElement>(null)
  const shown = expanded ? packages : packages.slice(0, named)
  const remaining = packages.length - named

  useEffect(() => {
    // why: the control that revealed the rest is gone the moment it is used, so focus moves onto the first pill it revealed rather than falling back to the page
    if (expanded) firstRevealed.current?.focus()
  }, [expanded])

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {shown.map((pkg, index) => (
        <PackageTag key={pkg.name} pill={pkg} ref={index === named ? firstRevealed : undefined} />
      ))}
      {!expanded && remaining > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-primary-300 hover:text-primary-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-primary-500/60 dark:hover:text-primary-400"
        >
          +{remaining} more
        </button>
      ) : null}
    </div>
  )
}

/** Props for {@link PackageTag}. */
interface PackageTagProps {
  /** The package the tag names */
  pill: PackagePill
  /** The anchor element, for the one tag that takes focus after a reveal */
  ref?: React.Ref<HTMLAnchorElement>
}

/**
 * One named package. The flagship keeps the shape of every other tag and gains
 * the page's own colour, which is the whole difference the strip needs: the
 * order already put it first, so the tag only has to say that the package
 * leading the row is leading it for a reason.
 * @param props - See {@link PackageTagProps}.
 * @param props.pill - The package the tag names
 * @param props.ref - The anchor element
 * @returns The rendered tag
 */
function PackageTag({ pill, ref }: PackageTagProps) {
  return (
    <a
      ref={ref}
      href={pill.href}
      title={pill.downloads === null ? undefined : `${formatExactCount(pill.downloads)} downloads so far`}
      className={
        pill.flagship
          ? 'inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-inset ring-primary-200 transition-colors hover:bg-primary-100 dark:bg-primary-950/60 dark:text-primary-300 dark:ring-primary-800 dark:hover:bg-primary-900/50'
          : 'inline-flex items-center rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-50 hover:text-primary-600 hover:ring-primary-200 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-primary-400 dark:hover:ring-primary-500/50'
      }
    >
      {pill.name}
    </a>
  )
}
