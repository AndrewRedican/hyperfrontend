import Link from 'next/link'

export function Hero() {
  return (
    <div className="relative overflow-hidden bg-slate-900 dark:bg-slate-950">
      <HeroBackground />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="bg-gradient-to-r from-indigo-200 via-sky-400 to-indigo-200 bg-clip-text font-display text-4xl font-bold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
            Micro-frontends without the headache
          </h1>
          <p className="mt-6 text-lg text-slate-400 sm:text-xl">
            Compose your existing apps together securely — like Lego bricks. No rewrites. No &quot;let&apos;s align on a shared component
            library&quot; meetings. Just plug it in and <em>it works</em>.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/docs" className="btn-primary">
              Get started
            </Link>
            <a href="https://github.com/AndrewRedican/hyperfrontend" target="_blank" rel="noopener noreferrer" className="btn-secondary">
              View on GitHub
            </a>
          </div>
          <div className="mt-8">
            <InstallSnippet />
          </div>
        </div>
      </div>
    </div>
  )
}

function InstallSnippet() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-lg bg-slate-800/50 ring-1 ring-white/10">
      <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-slate-600" />
          <span className="h-3 w-3 rounded-full bg-slate-600" />
          <span className="h-3 w-3 rounded-full bg-slate-600" />
        </div>
        <span className="text-xs text-slate-500">Terminal</span>
      </div>
      <div className="p-4">
        <code className="text-sm text-slate-300">
          <span className="text-sky-400">npm</span> install @hyperfrontend/nexus
        </code>
      </div>
    </div>
  )
}

function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute -right-1/4 top-1/4 h-[400px] w-[400px] rounded-full bg-indigo-500/20 blur-3xl" />
    </div>
  )
}
