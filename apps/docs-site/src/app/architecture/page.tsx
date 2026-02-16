import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export default function ArchitecturePage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white">Architecture</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Architecture documentation is coming soon. Check back later.</p>
      </main>
      <Footer />
    </>
  )
}
