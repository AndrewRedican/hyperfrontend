import { ClockHero } from '@/components/demos/clock-hero'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { ScrollToExplore } from '@/components/scroll-to-explore'
import { TesseractBackground } from '@/components/tesseract-background'
import { ValueProposition } from '@/components/value-proposition'

/**
 * Featured package tile shown on the landing page: display name, link target,
 * and a priority used to sort the list ascending.
 */
type FeaturedPackage = {
  name: string
  href: string
  priority: number
}

/**
 * High-value packages to display on the landing page, sorted by priority.
 * Lower priority numbers appear first.
 */
const FEATURED_PACKAGES: Array<FeaturedPackage> = [
  { name: '@hyperfrontend/nexus', href: '/docs/libraries/nexus', priority: 1 },
  { name: '@hyperfrontend/features', href: '/docs/libraries/features', priority: 2 },
  { name: '@hyperfrontend/builder', href: '/docs/libraries/builder', priority: 3 },
  { name: '@hyperfrontend/state-machine', href: '/docs/libraries/state-machine', priority: 4 },
  { name: '@hyperfrontend/data-utils', href: '/docs/libraries/utils/data', priority: 5 },
  { name: '@hyperfrontend/string-utils', href: '/docs/libraries/utils/string', priority: 6 },
  { name: '@hyperfrontend/list-utils', href: '/docs/libraries/utils/list', priority: 7 },
  { name: '@hyperfrontend/time-utils', href: '/docs/libraries/utils/time', priority: 8 },
  { name: '@hyperfrontend/json-utils', href: '/docs/libraries/utils/json', priority: 9 },
  { name: '@hyperfrontend/function-utils', href: '/docs/libraries/utils/function', priority: 10 },
].sort((a, b) => a.priority - b.priority)

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        {/* Hero Section - 50/50 Split Layout */}
        <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] bg-[length:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)]" />

          {/* Composability matrix — a 4D micro-frontend lattice diving through nested layers */}
          <TesseractBackground dive />

          <div className="relative mx-auto flex h-full max-w-8xl flex-col lg:flex-row lg:items-stretch">
            {/* Left Side - Value Proposition */}
            <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-8 lg:w-1/2 lg:px-12 lg:py-8 xl:px-16">
              <ValueProposition />
            </div>

            {/* Right Side - Live Clock Demo */}
            <div className="flex w-full items-center justify-center border-t border-slate-200 bg-slate-100/50 px-6 py-12 dark:border-slate-700 dark:bg-slate-800/30 sm:px-8 lg:w-1/2 lg:border-l lg:border-t-0 lg:px-12 lg:py-8">
              <ClockHero />
            </div>
          </div>

          {/* Scroll Indicator - hidden on mobile where content is stacked */}
          <ScrollToExplore />
        </section>

        {/* Secondary Content - Collapsed for Landing */}
        <section id="how-it-works" className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">How it works</h2>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400">
                Each feature operates in its own iframe with standardized communication via the{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm dark:bg-slate-800">@hyperfrontend/nexus</code>{' '}
                library. Messages are routed through a broker-channel architecture with optional encryption.
              </p>
            </div>

            {/* Architecture Cards */}
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <ArchitectureCard
                title="Host Application"
                description="Your main app loads features dynamically and manages their lifecycle. No build-time dependencies."
                icon={<HostIcon />}
                href="/architecture#runtime-flow"
              />
              <ArchitectureCard
                title="Feature Shell"
                description="A lightweight loader that bootstraps your micro-frontend and establishes the communication channel."
                icon={<ShellIcon />}
                href="/architecture#the-shell-pattern"
              />
              <ArchitectureCard
                title="Message Broker"
                description="Routes typed messages between contexts with validation. Supports encryption for sensitive data."
                icon={<BrokerIcon />}
                href="/architecture#broker-channel-model"
              />
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <a
                href="/architecture"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Read the Architecture Guide
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Standalone Packages Strip */}
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
                  <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">18+ standalone utility packages for any project</span>
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
              {FEATURED_PACKAGES.map((pkg) => (
                <PackageTag key={pkg.name} name={pkg.name} href={pkg.href} />
              ))}
              <span className="text-xs text-slate-400 dark:text-slate-500 self-center">+8 more</span>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

/** Props for {@link PackageTag} */
type PackageTagProps = { name: string; href: string }

function PackageTag({ name, href }: PackageTagProps) {
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-primary-600 hover:ring-primary-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-primary-400 dark:hover:ring-primary-500/50"
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

/** Props for {@link ArchitectureCard} */
type ArchitectureCardProps = {
  title: string
  description: string
  icon: React.ReactNode
  href: string
}

function ArchitectureCard({ title, description, icon, href }: ArchitectureCardProps) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-slate-200 bg-slate-50 p-6 transition-colors hover:border-primary-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-primary-600 dark:hover:bg-slate-800"
    >
      <div className="mb-4 inline-flex rounded-lg bg-primary-50 p-2.5 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </a>
  )
}

function HostIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
      />
    </svg>
  )
}

function ShellIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  )
}

function BrokerIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
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
