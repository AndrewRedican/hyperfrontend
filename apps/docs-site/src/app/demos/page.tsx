import type { Metadata } from 'next'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { TesseractBackground } from '@/components/tesseract-background'

export const metadata: Metadata = {
  title: 'Live Demos',
  description: 'Interactive demonstrations of hyperfrontend micro-frontend architecture across frameworks.',
}

export default function DemosPage() {
  return (
    <>
      <Header />
      <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        {/* Diving composability matrix while live demos are in the works */}
        <TesseractBackground dive intensity="subtle" />
        <div className="relative mx-auto max-w-7xl text-center">
          <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Live Demos</h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Interactive demos are coming soon. Check back later.</p>
        </div>
      </main>
      <Footer />
    </>
  )
}
