import type { Metadata } from 'next'
import { CoverFlow } from '@/components/demos/cover-flow'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { DEMO_MANIFEST } from '@/lib/demo-manifest'

export const metadata: Metadata = {
  title: 'Live Demos',
  description: 'Interactive demonstrations of hyperfrontend micro-frontend architecture across frameworks and origin boundaries.',
}

export default function DemosPage() {
  return (
    <>
      <Header />
      <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative mx-auto w-full max-w-5xl text-center">
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Live Demos</h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
            Each demo is a real feature app on its own origin, embedded here through its generated shell. The centered card is live — drag,
            scroll, or use the arrow keys to browse.
          </p>
          <div className="mt-10">
            <CoverFlow entries={DEMO_MANIFEST} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
