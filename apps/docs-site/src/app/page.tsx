import { DemoStageProvider } from '@/components/demo-stage'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { LandingDiscoverySection } from '@/components/landing-discovery-section'
import { LandingHero } from '@/components/landing-hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { StageAccent } from '@/components/landing/stage-accent'
import { LightWell } from '@/components/light-well'
import { getAllLibraryData } from '@/lib/docs-loader'
import { getDownloadsSnapshot } from '@/lib/downloads'
import { FLAGSHIP_PACKAGE } from '@/lib/ecosystem'
import { selectFeaturedPackages } from '@/lib/landing-highlights'

/** How many packages the strip names before sending readers to the library index. */
const NAMED_PACKAGE_COUNT = 8

export default function HomePage() {
  const libraries = getAllLibraryData()
  const featuredPackages = selectFeaturedPackages(libraries, NAMED_PACKAGE_COUNT)
  const downloads = getDownloadsSnapshot()

  return (
    <DemoStageProvider>
      {/* why: the staged demo's hue reaches the header as well as the water below the fold, so the stage wraps the whole page rather than the hero alone */}
      <StageAccent />
      <div className="flex min-h-screen flex-col">
        <Header staged />
        <main id="main-content" className="flex-1">
          {/* Hero Section - 50/50 Split Layout */}
          <LandingHero downloads={downloads === null ? null : { total: downloads.total, packages: downloads.packages.length }} />

          {/* Tutorials, how-to guides, the launch film, demos, and articles on one arc, in water lit by the staged demo */}
          <LightWell>
            <LandingDiscoverySection />
          </LightWell>

          <HowItWorks />

          {/* Packages Strip - the top of the library hierarchy, flagship first */}
          <section className="border-t border-slate-200 bg-slate-50 py-8 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <a
                  href="https://www.npmjs.com/search?q=%40hyperfrontend"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <NpmIcon className="h-6 w-6 text-red-500 dark:text-red-400 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">Also on npm</span>
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                      {libraries.length} packages, from the SDK down to the single-purpose utilities
                    </span>
                  </div>
                </a>
                <a
                  href="/docs/libraries"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 whitespace-nowrap"
                >
                  Browse all packages
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {featuredPackages.map((pkg) => (
                  <PackageTag
                    key={pkg.packageName}
                    name={pkg.packageName}
                    href={pkg.href}
                    flagship={pkg.packageName === FLAGSHIP_PACKAGE}
                  />
                ))}
                <span className="text-xs text-slate-400 dark:text-slate-500 self-center">
                  +{libraries.length - featuredPackages.length} more
                </span>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </DemoStageProvider>
  )
}

/** Props for {@link PackageTag} */
type PackageTagProps = { name: string; href: string; flagship?: boolean }

/**
 * One named package. The flagship keeps the shape of every other tag and gains
 * the page's own colour, which is the whole difference the strip needs: the
 * hierarchy already put it first, so the tag only has to say that the package
 * leading the row is leading it for a reason.
 * @param props - Component props
 * @param props.name - npm package name
 * @param props.href - Route to the package's documentation
 * @param props.flagship - Whether this is the package the hierarchy opens on
 * @returns The rendered tag
 */
function PackageTag({ name, href, flagship }: PackageTagProps) {
  return (
    <a
      href={href}
      className={
        flagship
          ? 'inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-inset ring-primary-200 hover:bg-primary-100 transition-colors dark:bg-primary-950/60 dark:text-primary-300 dark:ring-primary-800 dark:hover:bg-primary-900/50'
          : 'inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-primary-600 hover:ring-primary-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-primary-400 dark:hover:ring-primary-500/50'
      }
    >
      {name}
    </a>
  )
}

/** Common props for landing-page icons */
type IconProps = { className?: string }

function NpmIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z" />
    </svg>
  )
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
