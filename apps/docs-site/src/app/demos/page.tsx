import type { Metadata } from 'next'
import { DemosGallery } from '@/components/demos/demos-gallery'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { DEMO_MANIFEST } from '@/lib/demo-manifest'

export const metadata: Metadata = {
  title: 'Live Demos',
  description: 'Interactive demonstrations of hyperfrontend micro-frontend architecture across frameworks and origin boundaries.',
}

/**
 * The demos page: the gallery deck with its floating host console.
 * @returns The page markup.
 */
export default function DemosPage() {
  return (
    <>
      <Header />
      <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative mx-auto w-full max-w-5xl text-center">
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Live Demos</h1>
          {/* why: Vertical space is precious on narrow layouts — the preamble only earns its keep where the gallery has room to spare. */}
          <p className="mt-3 hidden text-base text-slate-600 dark:text-slate-400 sm:block">
            Each demo is a real feature app on its own origin, embedded here through its generated shell. The centered card is live — browse
            by dragging, scrolling, the arrow keys, or the side dial on portrait screens.
          </p>
          <div className="mt-10">
            <DemosGallery entries={DEMO_MANIFEST} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
