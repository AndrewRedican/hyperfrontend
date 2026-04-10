import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Sidebar - hidden on mobile */}
        <aside className="hidden self-start border-r border-slate-200 pr-8 dark:border-slate-700 lg:block">
          <Sidebar />
        </aside>

        {/* Main Content */}
        <main id="main-content" className="min-w-0 flex-1 py-10 lg:pl-8">
          {children}
        </main>
      </div>
      <Footer />
    </>
  )
}
