import { getAllLibraryData } from '@/lib/docs-loader'
import { getDownloadsSnapshot } from '@/lib/downloads'
import { FLAGSHIP_PACKAGE } from '@/lib/ecosystem'
import { orderPackagesByDownloads } from '@/lib/landing-highlights'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { ArrowGlyph } from './discovery-icons'
import { PackageStrip } from './package-strip'

/** How many packages the strip names before offering the rest. */
const NAMED_PACKAGE_COUNT = 8

/**
 * The packages strip: the flagship first, then every other published package
 * in the order the world has been installing them, counted from the same
 * download history the downloads page charts.
 * @returns The rendered section.
 */
export function PackagesSection() {
  const totals = createMap((getDownloadsSnapshot()?.packages ?? []).map((entry): [string, number] => [entry.package, entry.total]))
  const packages = orderPackagesByDownloads(getAllLibraryData(), totals).map((library) => ({
    name: library.packageName,
    href: library.href,
    flagship: library.packageName === FLAGSHIP_PACKAGE,
    downloads: totals.get(library.packageName) ?? null,
  }))

  return (
    <section className="border-t border-slate-200/70 bg-slate-50/60 py-10 dark:border-slate-800/70 dark:bg-slate-950/25">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="https://www.npmjs.com/search?q=%40hyperfrontend"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <NpmIcon className="h-6 w-6 shrink-0 text-red-500 dark:text-red-400" />
            <div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">Also on npm</span>
              <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                {packages.length} packages, from the SDK down to the single-purpose utilities
              </span>
            </div>
          </a>
          <a
            href="/docs/libraries"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Browse all packages
            <ArrowGlyph className="h-3.5 w-3.5" />
          </a>
        </div>
        <PackageStrip packages={packages} named={NAMED_PACKAGE_COUNT} />
      </div>
    </section>
  )
}

/** Props for {@link NpmIcon}. */
interface NpmIconProps {
  /** Classes for the svg element, which sizes it */
  className?: string
}

/**
 * The npm wordmark.
 * @param props - See {@link NpmIconProps}.
 * @param props.className - Classes for the svg element
 * @returns The glyph.
 */
function NpmIcon({ className }: NpmIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z" />
    </svg>
  )
}
