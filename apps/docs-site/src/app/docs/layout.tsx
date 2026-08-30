import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { Sidebar } from '@/components/sidebar'
import { navVisibility } from '@/lib/nav-visibility'

type DocsLayoutProps = { children: React.ReactNode }

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <>
      <Header />
      <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Sidebar - the mobile drawer covers every width below this one, sticky on desktop */}
        <aside className={`sticky top-16 h-[calc(100vh-4rem)] self-start dark:border-slate-700 ${navVisibility.sidebar}`}>
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
