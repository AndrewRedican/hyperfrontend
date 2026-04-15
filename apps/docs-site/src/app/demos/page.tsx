import type { Metadata } from 'next'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'

export const metadata: Metadata = {
  title: 'Live Demos',
  description: 'Interactive demonstrations of hyperfrontend micro-frontend architecture across frameworks.',
}

export default function DemosPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Live Demos</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Interactive demos are coming soon. Check back later.</p>
      </main>
      <Footer />
    </>
  )
}
