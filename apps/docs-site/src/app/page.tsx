import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ValueProposition } from '@/components/value-proposition'
import { DemoShowcase } from '@/components/demo-showcase'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        {/* Hero Section - 50/50 Split Layout */}
        <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] bg-[length:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)]" />

          <div className="relative mx-auto flex h-full max-w-8xl flex-col lg:flex-row lg:items-stretch">
            {/* Left Side - Value Proposition */}
            <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-8 lg:w-1/2 lg:px-12 lg:py-8 xl:px-16">
              <ValueProposition />
            </div>

            {/* Right Side - Demo Showcase */}
            <div className="flex w-full items-center justify-center border-t border-slate-200 bg-slate-100/50 px-6 py-12 dark:border-slate-700 dark:bg-slate-800/30 sm:px-8 lg:w-1/2 lg:border-l lg:border-t-0 lg:px-12 lg:py-8">
              <DemoShowcase cycleDuration={20000} />
            </div>
          </div>
        </section>

        {/* Secondary Content - Collapsed for Landing */}
        <section className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900 lg:py-24">
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
              />
              <ArchitectureCard
                title="Feature Shell"
                description="A lightweight loader that bootstraps your micro-frontend and establishes the communication channel."
                icon={<ShellIcon />}
              />
              <ArchitectureCard
                title="Message Broker"
                description="Routes typed messages between contexts with validation. Supports encryption for sensitive data."
                icon={<BrokerIcon />}
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
      </main>
      <Footer />
    </div>
  )
}

function ArchitectureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="mb-4 inline-flex rounded-lg bg-primary-50 p-2.5 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
